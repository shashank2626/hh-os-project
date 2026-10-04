# 🏠 Household OS
### The Intelligent AI Operating System for Indian Households

> Built from scratch for hackathon evaluation: A fully functional, production-grade household management platform where UI, Prisma database, Gemini AI function calling, predictive math, and real-time state mutations are connected end-to-end.

---

## 🌟 Product Vision

Managing an Indian household involves continuous micro-decisions:
- Running out of daily essentials like **Chakki Atta, Milk, and Dishwashing Gel**
- Tracking servicing intervals for appliances (**RO Water Purifier filters, AC foam jet cleans, Geyser anode rods**)
- Paying recurring Indian utility bills (**Tata Power electricity, Mahanagar Gas PNG, JioFiber, Society Maintenance**)
- Coordinating family chores and domestic staff (**Cook and Maid salaries**)
- Managing purchase invoices and warranties

**Household OS** closes this loop autonomously:
$$\text{INGEST} \rightarrow \text{UNDERSTAND} \rightarrow \text{STORE} \rightarrow \text{PREDICT} \rightarrow \text{RECOMMEND} \rightarrow \text{USER APPROVES} \rightarrow \text{EXECUTE} \rightarrow \text{UPDATE HOUSEHOLD STATE}$$

---

## 🚀 Live Functional Modules & Routes

| Module | Route | What It Does |
|---|---|---|
| **Command Center Dashboard** | `/dashboard` | Real-time household health score gauge (0-100), urgent alerts, low-stock warnings, upcoming bills, and quick batch-resolution. |
| **Smart Inventory** | `/inventory` | Pantry stock levels, daily consumption rates, buffer thresholds, depletion countdowns, and audit events. |
| **Inventory Item Deep-Dive** | `/inventory/[id]` | Event logs for restocks and daily consumption history. |
| **AI Procurement Bridge** | `/procurement` | Value comparison packs (e.g. 10kg value pack vs 2x5kg), Blinkit/Zepto deep-links, and "Buy Now" database restock workflow. |
| **AI Household Assistant** | `/assistant` | Real Gemini AI agent with function calling over real Prisma database tools. Visualizes tool execution steps in real-time. |
| **Document Intelligence** | `/documents` | Multimodal AI pipeline parsing Indian tax invoices, quick-commerce receipts, and electricity bills with downstream state updates. |
| **Document Detail** | `/documents/[id]` | Zod-validated structured extraction JSON inspection. |
| **Appliances & Assets** | `/assets` | Equipment health scores, location tracking, warranty monitoring, and service histories. |
| **Asset Detail & Service Log** | `/assets/[id]` | Telemetry and "Log Completed Service" action that restores equipment health. |
| **Predictive Maintenance** | `/maintenance` | Deterministic degradation math for service due dates and overdue equipment alarms (e.g. Kent RO). |
| **Chore Delegation & Tasks** | `/tasks` | Priority tasks with AI-assisted member recommendation based on availability. |
| **Family & Domestic Helpers** | `/family` | Family roles, preferences, availability, and active task workloads. |
| **Household Utility Bills** | `/bills` | Tata Power, Mahanagar Gas, JioFiber bills with 1-click "Pay via UPI" settlement. |
| **Finance & Ledger** | `/finance` | Spending category breakdown with automated spending anomaly detection (>20% spike analysis). |
| **Activity Audit Stream** | `/activity` | Chronological event stream tracking every database mutation. |
| **System Settings** | `/settings` | Gemini AI key configuration, household profile, and 1-click database demo reset. |

---

## 🇮🇳 India-First Architecture & Design

- **Currency**: Indian Rupees (`₹ INR`) with Indian number formatting (e.g. `₹2,340`, `₹14,500`, `₹1,25,000`).
- **Date Formats**: Indian standard readable dates (`05 Oct 2026`).
- **Household Context**: Designed for Indian domestic workflows (Cook/Maid monthly salaries, Society Maintenance, RO filter replacements, Inverter battery checks, Piped Natural Gas / Cylinder bookings).
- **Retailer Bridge**: Deep links to Blinkit, Zepto, Swiggy Instamart, and Amazon India.
- **Payment Rails**: Simulated UPI (Google Pay, PhonePe, Paytm), Net Banking, and Card settlement.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: Next.js 16 (App Router, Turbopack, React 19)
- **Language**: TypeScript (Strict typing)
- **Database & ORM**: PostgreSQL-ready Prisma ORM with SQLite default (`file:./dev.db`) for zero-configuration local execution
- **Styling**: Tailwind CSS v4, Lucide Icons, clean charcoal/navy + emerald theme
- **AI Orchestration**: Google Generative AI (`@google/generative-ai` / Gemini 1.5 Flash) with function calling + deterministic fallback router
- **Schema Validation**: Zod

---

## ⚡ Quick Start & Running Locally

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd hackaton1
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional: Add your Google AI Studio `GEMINI_API_KEY` for live multimodal camera/document extraction. If omitted, the built-in intelligent Indian Household engine handles all extraction & tools automatically!)*

### 3. Initialize & Seed Database
```bash
npx prisma db push
npm run db:seed
```

### 4. Run Automated Test Suite
```bash
npm test
```
*Verifies 13 automated tests across inventory calculations, maintenance degradation formulas, anomaly detection, Zod validation, and live database tool execution.*

### 5. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🎬 Hackathon Demonstration Script (Step-by-Step)

1. **Command Center Overview** (`/dashboard`):
   - Notice the Household Health Score (74/100) reflecting overdue Kent RO service and low Atta/Milk.
   - Click **"Resolve All 4 Items Automatically"** to watch the autonomous AI engine settle the power bill, book RO service, and restock low items in a single click!
2. **AI Document Intelligence** (`/documents`):
   - Click **"Test Extract AC Invoice"** (or upload any bill).
   - Review the extracted Voltas Inverter AC fields (₹38,990, 12-month warranty, serial number).
   - Click **"Confirm & Apply Changes"** — watch a new appliance asset, warranty record, and maintenance task appear automatically across the dashboard!
3. **AI Household Assistant** (`/assistant`):
   - Ask: *"What do I need to buy this week?"* — observe real database tools queried in real time (`get_low_stock_items`).
   - Ask: *"Which appliances need maintenance?"* — returns exact deterministic days remaining and health scores.
   - Ask: *"Why did my electricity bill increase?"* — returns the 23.8% summer load anomaly explanation.
4. **Universal Command Palette** (`Ctrl+K`):
   - Press `Ctrl+K` from any page to instantly search assets, pantry items, utility bills, and chores.
5. **Activity Feed** (`/activity`):
   - Inspect the chronological audit stream verifying that every AI action, receipt confirmation, and bill settlement mutated real database state.

---

*Designed & engineered with ❤️ for Indian Households.*
