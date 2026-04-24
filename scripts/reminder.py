import asyncio
import os
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client
from telegram import Bot
from telegram.constants import ParseMode

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL      = os.environ["SUPABASE_URL"]
SUPABASE_KEY      = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TELEGRAM_TOKEN    = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT_ID  = os.environ["TELEGRAM_CHAT_ID"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_due_orders() -> list[dict]:
    """
    Fetch orders where:
      - delivery_datetime falls on tomorrow (any time)
      - is_reminded = False
    Uses UTC date window to handle timestamptz correctly.
    """
    now_utc      = datetime.now(timezone.utc)
    tomorrow_start = (now_utc + timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    tomorrow_end   = tomorrow_start + timedelta(days=1)

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
    """Convert ISO timestamptz → human-readable WIB (UTC+7)."""
    dt = datetime.fromisoformat(dt_str)
    wib = timezone(timedelta(hours=7))
    dt_wib = dt.astimezone(wib)
    return dt_wib.strftime("%A, %d %B %Y  %H:%M WIB")


def build_message(order: dict, items: list[dict]) -> str:
    """Compose the Telegram message (MarkdownV2-safe)."""
    items_text = "\n".join(
        f"  • {item['item_name']} × {item['quantity']}"
        for item in items
    ) or "  _No item detail found_"

    msg = (
        f"🔔 *DELIVERY REMINDER*\n"
        f"{'─' * 30}\n\n"
        f"👤 *Name:*\n{order['name']}\n\n"
        f"📱 *WhatsApp:*\n{order['whatsapp']}\n\n"
        f"📦 *Total Items:* {order['total_items']}\n\n"
        f"🗂 *Items:*\n{items_text}\n\n"
        f"🚚 *Delivery Type:*\n{order['delivery_type']}\n\n"
        f"🕐 *Delivery Time:*\n{format_delivery_datetime(order['delivery_datetime'])}\n\n"
        f"📍 *Address:*\n{order['delivery_address']}\n"
    )
    return msg


async def run():
    bot    = Bot(token=TELEGRAM_TOKEN)
    orders = fetch_due_orders()

    if not orders:
        print("✅ No upcoming deliveries to remind.")
        return

    print(f"📬 Found {len(orders)} order(s) to remind.")

    for order in orders:
        try:
            items   = fetch_order_items(order["id"])
            message = build_message(order, items)

            await bot.send_message(
                chat_id    = TELEGRAM_CHAT_ID,
                text       = message,
                parse_mode = ParseMode.MARKDOWN,
            )

            mark_as_reminded(order["id"])
            print(f"  ✔ Reminded order #{order['id']} — {order['name']}")

        except Exception as e:
            # Don't crash the whole run for a single failed order
            print(f"  ✗ Failed order #{order['id']}: {e}")


if __name__ == "__main__":
    asyncio.run(run())