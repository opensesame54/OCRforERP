# Accounts Payable OCR System Credentials

This file contains the seeded user accounts and their dynamically generated random passwords for local development and testing.

| Name | Role | Email | Password |
| :--- | :--- | :--- | :--- |
| **John AP Clerk** | AP Clerk | `clerk@ap.com` | `clerk_H4AoW0DW` |
| **Sarah Reviewer** | Reviewer | `reviewer@ap.com` | `reviewer_yaBpxni4` |
| **Michael Manager** | Finance Manager | `manager@ap.com` | `manager_xqm5GHVZ` |
| **Admin User** | Admin | `admin@ap.com` | `admin_ymZFct5z` |

---

## Roles Overview

1. **AP Clerk**: Handles uploading invoices, staging queue inspection, exception queues, PO matching, and vendor entries.
2. **Reviewer**: Solely reviews whether OCR worked and invoices are inserted into the system. Access is strictly read-only on the Dashboard and Staging Queue (Review metadata and duplicate views).
3. **Finance Manager**: Full financial access, approvals, rejections, posting bills to Odoo ERP, and viewing audit trails.
4. **Admin**: Full administrative permissions across all tabs including business rule parameter configurations and toggles.
