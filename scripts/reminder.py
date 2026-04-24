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


def fetch_due_orders() -> list[dict]:
    """
    Fetch orders where:
      - delivery_datetime falls on tomorrow (any time)
      - is_reminded = False
    Uses a business-timezone date window converted to UTC for timestamptz.
    """
    tomorrow_start, tomorrow_end = tomorrow_window_utc()
    print(
        "ℹ️ Query window UTC:",
        tomorrow_start.isoformat(),
        "to",
        tomorrow_end.isoformat(),
        f"(business TZ: {REMINDER_TIMEZONE})",
    )

    response = (
        supabase.table("order_sales")
        .select("id, name, whatsapp, total_items, delivery_datetime, delivery_address, delivery_type")
        .gte("delivery_datetime", tomorrow_start.isoformat())
        .lt("delivery_datetime",  tomorrow_end.isoformat())
        .eq("is_reminded", False)
        .execute()
    )
    return response.data or []


def fetch_order_items(order_id: int) -> list[dict]:
    """Fetch item details from the view for a given order."""
    response = (
        supabase.table("order_sales_detail_view")
        .select("item_name, quantity")
        .eq("order_sales_id", order_id)
        .execute()
    )
    return response.data or []


def mark_as_reminded(order_id: int) -> None:
    """Flip is_reminded = True after a successful notification."""
    supabase.table("order_sales").update({"is_reminded": True}).eq("id", order_id).execute()


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


async def run():
    bot = Bot(token=TELEGRAM_TOKEN)

    me = await bot.get_me()
    print(f"🤖 Connected Telegram bot: @{me.username or me.id}")
    chat = await bot.get_chat(TELEGRAM_CHAT_ID)
    print(f"💬 Target chat resolved: {chat.id} ({getattr(chat, 'type', 'unknown')})")

    orders = fetch_due_orders()

    if not orders:
        print("✅ No upcoming deliveries to remind.")
        return

    print(f"📬 Found {len(orders)} order(s) to remind.")
    print("📋 Order IDs:", ", ".join(str(order["id"]) for order in orders))

    sent_count = 0
    fail_count = 0

    for order in orders:
        try:
            items = fetch_order_items(order["id"])
            message = build_message(order, items)

            await bot.send_message(
                chat_id    = TELEGRAM_CHAT_ID,
                text       = message,
                parse_mode = ParseMode.HTML,
            )

            mark_as_reminded(order["id"])
            sent_count += 1
            print(f"  ✔ Reminded order #{order['id']} — {order['name']}")

        except Exception as e:
            fail_count += 1
            print(f"  ✗ Failed order #{order['id']}: {e}")
            print(traceback.format_exc())

    print(f"✅ Sent: {sent_count}, ❌ Failed: {fail_count}")
    if fail_count > 0:
        raise RuntimeError(f"Reminder run completed with {fail_count} failed order(s)")


if __name__ == "__main__":
    asyncio.run(run())