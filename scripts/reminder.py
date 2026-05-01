import asyncio
import os
import traceback
from datetime import datetime, timezone, timedelta
from html import escape
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from supabase import create_client, Client
from telegram import Bot
from telegram.constants import ParseMode

# ── Config ────────────────────────────────────────────────────────────────────
load_dotenv()


def _required_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


SUPABASE_URL = _required_env("SUPABASE_URL")
SUPABASE_KEY = _required_env("SUPABASE_SERVICE_ROLE_KEY")
TELEGRAM_TOKEN = _required_env("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = _required_env("TELEGRAM_CHAT_ID")
REMINDER_TIMEZONE = os.getenv("REMINDER_TIMEZONE", "Asia/Jakarta")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def _get_business_tz() -> ZoneInfo:
    try:
        return ZoneInfo(REMINDER_TIMEZONE)
    except Exception as e:
        raise RuntimeError(
            f"Invalid REMINDER_TIMEZONE '{REMINDER_TIMEZONE}': {e}"
        ) from e


def _normalize_chat_target(raw_value: str) -> int | str:
    """Convert env value to a Telegram chat target accepted by Bot API."""
    value = raw_value.strip().strip('"').strip("'")
    if not value:
        raise RuntimeError("TELEGRAM_CHAT_ID is empty after trimming quotes/spaces")

    if value.lstrip("-").isdigit():
        return int(value)

    if value.startswith("@"):
        return value

    if " " not in value:
        return f"@{value}"

    raise RuntimeError(
        "TELEGRAM_CHAT_ID is not a valid numeric ID or @username value"
    )


async def _print_debug_chat_hints(bot: Bot) -> None:
    """Print chat IDs seen by bot updates to help user set TELEGRAM_CHAT_ID."""
    print("🔎 Debug: trying to read recent updates for visible chat IDs...")
    updates = await bot.get_updates(limit=20, timeout=5)
    if not updates:
        print("ℹ️ No updates found. Send /start to the bot (or message the group/channel) first.")
        return

    seen_chat_ids: set[int] = set()
    for upd in updates:
        message = getattr(upd, "message", None) or getattr(upd, "channel_post", None)
        if message and getattr(message, "chat", None):
            chat = message.chat
            if chat.id not in seen_chat_ids:
                seen_chat_ids.add(chat.id)
                print(
                    "  • chat_id=",
                    chat.id,
                    "type=",
                    getattr(chat, "type", "unknown"),
                    "title=",
                    getattr(chat, "title", None),
                    "username=",
                    getattr(chat, "username", None),
                )


def tomorrow_window_utc() -> tuple[datetime, datetime]:
    """Build UTC window for 'tomorrow' based on business timezone."""
    business_tz = _get_business_tz()
    now_local = datetime.now(business_tz)
    tomorrow_local_start = (now_local + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    tomorrow_local_end = tomorrow_local_start + timedelta(days=1)
    return (
        tomorrow_local_start.astimezone(timezone.utc),
        tomorrow_local_end.astimezone(timezone.utc),
    )


def today_window_utc() -> tuple[datetime, datetime]:
    """Build UTC window for 'today' based on business timezone."""
    business_tz = _get_business_tz()
    now_local = datetime.now(business_tz)
    today_local_start = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    today_local_end = today_local_start + timedelta(days=1)
    return (
        today_local_start.astimezone(timezone.utc),
        today_local_end.astimezone(timezone.utc),
    )


def fetch_orders_in_window(start_utc: datetime, end_utc: datetime) -> list[dict]:
    """
    Fetch orders where delivery_datetime is in [start_utc, end_utc).
    Uses UTC window for timestamptz filtering.
    """
    print(
        "ℹ️ Query window UTC:",
        start_utc.isoformat(),
        "to",
        end_utc.isoformat(),
        f"(business TZ: {REMINDER_TIMEZONE})",
    )

    response = (
        supabase.table("order_sales")
        .select("id, name, whatsapp, total_items, delivery_datetime, delivery_address, delivery_type")
        .gte("delivery_datetime", start_utc.isoformat())
        .lt("delivery_datetime", end_utc.isoformat())
        .execute()
    )
    return response.data or []


def fetch_reminders_map(order_ids: list[int]) -> dict[int, dict]:
    """Read reminder rows keyed by order_sales_id."""
    if not order_ids:
        return {}

    response = (
        supabase.table("reminders")
        .select("id, order_sales_id, is_reminded_tomorrow, is_reminded_today")
        .in_("order_sales_id", order_ids)
        .execute()
    )

    reminders = response.data or []
    return {int(row["order_sales_id"]): row for row in reminders}


def ensure_reminders_exist(order_ids: list[int], reminders_map: dict[int, dict]) -> dict[int, dict]:
    """Initialize missing reminder rows with both flags=False so reminders are sent on first run."""
    missing_ids = [order_id for order_id in order_ids if order_id not in reminders_map]
    if not missing_ids:
        return reminders_map

    payload = [
        {
            "order_sales_id": order_id,
            "is_reminded_tomorrow": False,  # FIX: default False agar reminder terkirim saat pertama kali
            "is_reminded_today": False,     # FIX: default False agar reminder terkirim saat pertama kali
        }
        for order_id in missing_ids
    ]
    response = (
        supabase.table("reminders")
        .insert(payload)
        .execute()
    )

    inserted_rows = response.data or []
    for row in inserted_rows:
        reminders_map[int(row["order_sales_id"])] = row

    print(
        "ℹ️ Initialized reminder rows (default false/false) for order IDs:",
        ", ".join(str(order_id) for order_id in missing_ids),
    )
    return reminders_map


def fetch_order_items(order_id: int) -> list[dict]:
    """Fetch item details from the view for a given order."""
    response = (
        supabase.table("order_sales_detail_view")
        .select("item_name, quantity")
        .eq("order_sales_id", order_id)
        .execute()
    )
    return response.data or []


def mark_reminder_flag(order_id: int, reminder_type: str) -> None:
    """Flip the reminder flag in reminders table after successful notification."""
    if reminder_type == "tomorrow":
        payload = {"is_reminded_tomorrow": True}
    elif reminder_type == "today":
        payload = {"is_reminded_today": True}
    else:
        raise RuntimeError(f"Unknown reminder_type: {reminder_type}")

    supabase.table("reminders").update(payload).eq("order_sales_id", order_id).execute()


def format_delivery_datetime(dt_str: str) -> str:
    """Convert ISO timestamptz to human-readable business timezone string."""
    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    dt_local = dt.astimezone(_get_business_tz())
    return dt_local.strftime(f"%A, %d %B %Y  %H:%M ({REMINDER_TIMEZONE})")


def build_message(order: dict, items: list[dict]) -> str:
    """Compose a Telegram-safe message using HTML parse mode."""
    items_text = "\n".join(
        f"• {escape(str(item['item_name']))} x {escape(str(item['quantity']))}"
        for item in items
    ) or "No item detail found"

    msg = (
        "🔔 <b>DELIVERY REMINDER</b>\n"
        f"{'-' * 30}\n\n"
        f"👤 <b>Name:</b>\n{escape(str(order['name']))}\n\n"
        f"📱 <b>WhatsApp:</b>\n{escape(str(order['whatsapp']))}\n\n"
        f"📦 <b>Total Items:</b> {escape(str(order['total_items']))}\n\n"
        f"🗂 <b>Items:</b>\n{items_text}\n\n"
        f"🚚 <b>Delivery Type:</b>\n{escape(str(order['delivery_type']))}\n\n"
        f"🕐 <b>Delivery Time:</b>\n{escape(format_delivery_datetime(str(order['delivery_datetime'])))}\n\n"
        f"📍 <b>Address:</b>\n{escape(str(order['delivery_address']))}\n"
    )
    return msg


def should_send_today_reminder(delivery_dt_str: str) -> bool:
    """Send 'today' reminder only on the H-6 hourly window.

    With an hourly scheduler, exact equality to 6 hours is too strict, so we
    treat H-6 as the window where remaining time is in (5h, 6h].
    """
    business_tz = _get_business_tz()
    now_local = datetime.now(business_tz)
    delivery_local = datetime.fromisoformat(delivery_dt_str.replace("Z", "+00:00")).astimezone(business_tz)

    if delivery_local.date() != now_local.date():
        return False

    diff = delivery_local - now_local
    return timedelta(hours=5) < diff <= timedelta(hours=6)


async def run():
    bot = Bot(token=TELEGRAM_TOKEN)
    target_chat = _normalize_chat_target(TELEGRAM_CHAT_ID)

    me = await bot.get_me()
    print(f"🤖 Connected Telegram bot: @{me.username or me.id}")
    try:
        chat = await bot.get_chat(target_chat)
        print(f"💬 Target chat resolved: {chat.id} ({getattr(chat, 'type', 'unknown')})")
    except Exception as e:
        print(f"❌ Failed to resolve TELEGRAM_CHAT_ID='{TELEGRAM_CHAT_ID}': {e}")
        print("💡 Make sure the bot has access to that chat:")
        print("   1) Private chat: open the bot and send /start from the same account/chat.")
        print("   2) Group: add bot to group and disable privacy mode if needed.")
        print("   3) Channel: add bot as admin before sending.")
        await _print_debug_chat_hints(bot)
        raise

    tomorrow_start, tomorrow_end = tomorrow_window_utc()
    today_start, today_end = today_window_utc()

    tomorrow_orders = fetch_orders_in_window(tomorrow_start, tomorrow_end)
    today_orders_all = fetch_orders_in_window(today_start, today_end)
    today_orders = [
        order for order in today_orders_all if should_send_today_reminder(str(order["delivery_datetime"]))
    ]

    all_orders = tomorrow_orders + today_orders
    order_ids = sorted({int(order["id"]) for order in all_orders})
    reminders_map = fetch_reminders_map(order_ids)
    reminders_map = ensure_reminders_exist(order_ids, reminders_map)

    tomorrow_to_send = [
        order
        for order in tomorrow_orders
        if reminders_map.get(int(order["id"]), {}).get("is_reminded_tomorrow") is False
    ]
    today_to_send = [
        order
        for order in today_orders
        if reminders_map.get(int(order["id"]), {}).get("is_reminded_today") is False
    ]

    orders = [(order, "tomorrow") for order in tomorrow_to_send] + [
        (order, "today") for order in today_to_send
    ]

    if not orders:
        print("✅ No deliveries that match reminder flags to send.")
        return

    print(
        f"📬 Found {len(orders)} reminder(s) to send "
        f"(tomorrow={len(tomorrow_to_send)}, today={len(today_to_send)})."
    )
    print("📋 Order IDs:", ", ".join(str(order["id"]) for order, _ in orders))

    sent_count = 0
    fail_count = 0

    for order, reminder_type in orders:
        try:
            items = fetch_order_items(order["id"])
            message = build_message(order, items)

            await bot.send_message(
                chat_id    = target_chat,
                text       = message,
                parse_mode = ParseMode.HTML,
            )

            mark_reminder_flag(order["id"], reminder_type)
            sent_count += 1
            print(
                f"  ✔ Reminded ({reminder_type}) order #{order['id']} — {order['name']}"
            )

        except Exception as e:
            fail_count += 1
            print(f"  ✗ Failed order #{order['id']}: {e}")
            print(traceback.format_exc())

    print(f"✅ Sent: {sent_count}, ❌ Failed: {fail_count}")
    if fail_count > 0:
        raise RuntimeError(f"Reminder run completed with {fail_count} failed order(s)")


if __name__ == "__main__":
    asyncio.run(run())
