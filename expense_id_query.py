from odoo_staging_uploader import OdooClient
import os

client = OdooClient(
    base_url=os.environ["ODOO_URL"],
    db=os.environ["ODOO_DB"],
    login=os.environ["ODOO_LOGIN"],
    api_key=os.environ["ODOO_API_KEY"],
)

attachments = client.execute_kw(
    "ir.attachment",
    "search_read",
    [[["res_model", "=", "x_invoice_staging"]]],
    {
        "fields": ["id", "name", "res_id"],
        "limit": 20,
    }
)

print(attachments)