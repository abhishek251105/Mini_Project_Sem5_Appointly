# Appointly — Full-Stack Appointment Scheduling Platform

Appointly is a full-stack appointment scheduling platform featuring an editorial dark-mode design system with seafoam green accents, robust calendar orchestration, Razorpay payment processing, and transactional email notifications.

It allows hosts to manage their availability, define free or paid meeting types, and accept seamless bookings from guests through personalized public booking links.

---

## 1. Features Overview

### 🎨 Editorial Design System & User Interface
- **Refined Seafoam Palette:** Deep mineral slate (`#0A1214`) canvas with seafoam green (`#2DD4BF`, `#14B8A6`) accents and mint highlights (`#5EEAD4`).
- **Typography Pairing:** Elegant **`Instrument Serif`** for prominent headlines, brand identity, and currency figures, paired with **`Inter`** for legible body copy and utility metadata.
- **Liquid Glass Aesthetic:** Backdrop-blurred glassmorphic surfaces with delicate seafoam-tinted borders (`border-teal-500/15`).
- **Fluid Motion:** Interactive controls and micro-interactions powered by overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Dynamic Hero Section:** Staggered typographic layout with an animated **Hero Text Shuffler** and instant handle reservation bar (`appointly.me/yourname`).

### 🔐 Authentication & Session Security
- Host registration and login with encrypted passwords (`bcryptjs`).
- Secure, stateless JWT authentication via `jose` stored in **`httpOnly` cookies (`session`)**.
- Protected dashboard layout with server-side authentication verification (`getCurrentUser()`).
- Session termination with automatic cookie expiration.

### 💼 Host Workspace & Dashboard (`/dashboard`)
- **Overview & Metrics:** Quick statistics for upcoming meetings, pending payment holds, active session types, and date overrides, plus an alert for the next scheduled meeting.
- **Meeting Types Manager:** Create, view, activate/deactivate, and delete session offerings with customizable durations, pricing (Free or ₹ INR), locations (e.g. Google Meet, Zoom), and descriptions.
- **Weekly Schedule Editor:** Set recurring available hours for each day of the week (Sunday through Saturday).
- **Date Overrides & Blackouts:** Block out holidays/vacations or define custom hours for specific calendar dates with optional reason labels.
- **Bookings Management:** Review confirmed, pending, and cancelled bookings with direct actions to **Reschedule** or **Cancel** appointments (triggering automated refund flows).
- **1-Click Sharing:** Copy personal public booking link or preview live public page directly from the navigation bar.

### 📅 Public Guest Booking Experience
- **Personalized Host Landing (`/[slug]`):** Dedicated vanity profile showcasing host bio, timezone, and bookable meeting type cards.
- **Interactive Calendar & Slot Selector (`/[slug]/[meetingTypeId]`):**
  - Month-by-month calendar navigation.
  - Real-time availability calculation respecting weekly hours, date overrides, booked slots, and timezone conversions (`date-fns-tz`).
  - Available time slot selection pills.
  - Guest contact form with name, email, and meeting notes/agenda.
- **Dual Checkout Flow:**
  - **Free Sessions:** Instant booking creation with status `CONFIRMED` and immediate confirmation dispatch.
  - **Paid Sessions:** Temporary 15-minute slot lock (`PENDING_PAYMENT`), Razorpay order creation, client checkout modal, and backend signature verification.
- **Booking Confirmation Receipt (`/booking/[id]/confirmed`):** Visual confirmation with host/guest recap, session details, and a 1-click **"Add to Google Calendar"** button.

### 💳 Payments & Refunds (Razorpay)
- Razorpay order creation for paid appointments.
- Server-side cryptographic signature verification (`HMAC-SHA256`).
- Automated cancellation refund handling with idempotency keys.
- Webhook endpoints for asynchronous event reconciliation.

### 📧 Transactional Emails (Resend)
- Automated confirmation emails for both host and guest.
- Clear notification queue tracking with error logging and retry status in PostgreSQL.

---

## 2. Technology Stack

| Layer | Technology | Description |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Unified full-stack framework for React server/client components and route handlers |
| **Language** | TypeScript 5 | Strict end-to-end type safety |
| **Styling** | Tailwind CSS 4 | Custom seafoam mineral theme and utility classes |
| **Icons** | Lucide React | Clean, modern vector icons |
| **Database** | PostgreSQL | Relational database for accounts, sessions, rules, and payments |
| **ORM** | Prisma 7 | Schema modeling, automated migrations, and client generation |
| **Auth** | JOSE & Bcrypt.js | JWT generation, verification, and password hashing |
| **Validation** | Zod | Runtime schema validation for requests and forms |
| **Date & Time** | date-fns & date-fns-tz | Timezone calculations and ISO string formatting |
| **Payments** | Razorpay SDK | Order creation, checkout modal, verification, and refunds |
| **Emails** | Resend | Modern email delivery platform |

---

## 3. Project Structure

```text
Appointly/
├── app/
│   ├── [slug]/                             # Public host profile & booking flow
│   │   ├── page.tsx                        # Host landing & meeting types list
│   │   └── [meetingTypeId]/
│   │       └── page.tsx                    # Date picker, slot selector & Razorpay checkout
│   ├── api/                                # Backend REST API Route Handlers
│   │   ├── auth/                           # Login, register, logout, me
│   │   ├── availability/                   # Weekly availability CRUD
│   │   ├── availability_override/          # Date blackout & custom hours CRUD
│   │   ├── bookings/                       # Host bookings list, cancel & reschedule
│   │   ├── meeting_type/                   # Meeting types CRUD
│   │   ├── payments/                       # Create-order, verify, webhook, reconcile
│   │   ├── public/                         # Public host, slots, and guest booking
│   │   ├── protected/                      # Auth test endpoint
│   │   └── test-email/                     # Email dispatch test endpoint
│   ├── booking/
│   │   └── [id]/confirmed/
│   │       └── page.tsx                    # Confirmed booking receipt & Google Calendar link
│   ├── dashboard/
│   │   └── page.tsx                        # Complete host workspace (overview, schedule, etc.)
│   ├── login/
│   │   └── page.tsx                        # Host authentication page
│   ├── signup/
│   │   └── page.tsx                        # Host registration page
│   ├── favicon.ico
│   ├── globals.css                         # Tailwind v4 theme, fonts, and liquid glass styles
│   ├── layout.tsx                          # Root HTML layout with Google Fonts
│   └── page.tsx                            # Editorial landing page with hero text shuffler
├── components/
│   └── ui/
│       ├── liquid-button.tsx               # Primary, secondary, and danger button styles
│       ├── liquid-card.tsx                 # Glassmorphic card container with hover illumination
│       ├── navbar.tsx                      # Fixed navigation with brand and auth state
│       ├── premium-nav-link.tsx            # Animated scale & underline navigation links
│       └── text-shuffler.tsx               # Rotating editorial tagline shuffler
├── lib/
│   ├── auth.ts                             # Server-side getCurrentUser helper
│   ├── booking-notifications.ts            # Resend email dispatch engine
│   ├── email-templates.ts                  # HTML email templates
│   ├── email.ts                            # Resend client instance
│   ├── payment-finalization.ts             # Transactional booking confirmation & emails
│   ├── payment-refund.ts                   # Razorpay refund executor
│   ├── prisma.ts                           # Global Prisma Client instance
│   ├── razorpay.ts                         # Razorpay client instance
│   ├── refund-reconciliation.ts            # Webhook refund idempotency logic
│   ├── session.ts                          # JWT sign and verify helpers
│   └── utils.ts                            # Classnames merger (cn), currency & duration formatters
├── prisma/
│   ├── migrations/                         # PostgreSQL database migrations
│   └── schema.prisma                       # Complete database schema definition
├── .env.example                            # Sample environment configuration template
├── next.config.ts                          # Next.js configuration
├── package.json                            # Scripts and dependencies
├── prisma.config.ts                        # Prisma configuration
└── README.md                               # Project documentation
```

---

## 4. Getting Started

### Prerequisites
- **Node.js**: v20 or higher (v22 recommended)
- **npm** or compatible package manager
- **PostgreSQL**: Running locally or on a cloud provider (Supabase, Neon, etc.)
- **Razorpay Account**: Test API keys for payments
- **Resend Account**: API key for email delivery

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/abhishek251105/Mini_Project_Sem5_Appointly.git
cd Mini_Project_Sem5_Appointly
npm install
```

### 2. Configure Environment Variables
Copy the provided `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Open `.env` and fill in your credentials:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/appointly?schema=public"

# Authentication (random string, 32+ characters)
SESSION_SECRET="your-super-secret-session-key-minimum-32-chars-long"

# Razorpay (from Razorpay Dashboard -> Settings -> API Keys)
RAZORPAY_KEY_ID="rzp_test_yourKeyId"
RAZORPAY_KEY_SECRET="yourRazorpaySecret"
RAZORPAY_WEBHOOK_SECRET="yourRazorpayWebhookSecret"

# Resend (from https://resend.com/api-keys)
RESEND_API_KEY="re_yourResendApiKey"
RESEND_FROM_EMAIL="Appointly <onboarding@resend.dev>"
RESEND_TEST_EMAIL="your-email@example.com"
```

### 3. Setup the Database
Generate the Prisma Client:
```bash
npx prisma generate
```

Push the database schema to your PostgreSQL instance:
```bash
npx prisma db push
```

*(Alternatively, run migrations with `npx prisma migrate dev`)*

### 4. Run the Development Server
Because Appointly is built on Next.js Full-Stack App Router, both the frontend and backend run together from a single command:
```bash
npm run dev
```

Open your browser and navigate to:
```text
http://localhost:3000
```

### 5. Production Build
To create an optimized production build:
```bash
npm run build
npm run start
```

---

## 5. User Workflows

### Host Workflow
1. **Sign Up:** Navigate to `/signup` and register with name, email, and password. The system generates a personalized vanity slug (e.g. `jane-doe-9f8a7b6c`).
2. **Dashboard Overview:** Visit `/dashboard` to view statistics and your personalized link.
3. **Configure Offerings:** Go to **Meeting Types** tab → click **"New Meeting Type"** → enter title, duration (e.g. 30 mins), price in ₹ INR (0 for Free), and location.
4. **Set Working Schedule:** Go to **Availability** tab → add active hours for each day of the week (e.g., Monday–Friday, `09:00` to `17:00`).
5. **Add Blackouts/Overrides:** Use the Date Override section to block specific dates (e.g. holidays or leaves).
6. **Manage Bookings:** View incoming appointments under the **Bookings** tab; cancel sessions with automated refund triggers or reschedule existing bookings.

### Guest Booking Workflow
1. **Visit Host Page:** Open `http://localhost:3000/[slug]`.
2. **Choose Meeting Type:** Select a meeting offering (e.g., *"30-Minute Consultation"*).
3. **Pick Date & Time:** Select an available date on the calendar, then choose from dynamically calculated conflict-free time slots.
4. **Enter Contact Details:** Provide guest name, email, and optional notes/agenda.
5. **Confirm / Pay:**
   - **Free Session:** Instantly confirmed; host and guest receive Resend confirmation emails.
   - **Paid Session:** Opens the embedded Razorpay checkout dialog; once payment is completed and verified, status updates to `CONFIRMED`.
6. **Receipt Screen:** Access `/booking/[id]/confirmed` to view confirmation details and click **"Add to Google Calendar"**.

---

## 6. API Reference

All backend endpoints are implemented as Next.js route handlers under `app/api/`.

### 6.1 Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new host account | No |
| `POST` | `/api/auth/login` | Authenticate host & set session cookie | No |
| `POST` | `/api/auth/logout` | Terminate session & clear cookie | No |
| `GET` | `/api/auth/me` | Retrieve authenticated host profile | Yes |

### 6.2 Meeting Types (`/api/meeting_type`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/meeting_type` | Create a new session offering | Yes |
| `GET` | `/api/meeting_type` | List all meeting types for host | Yes |
| `PATCH` | `/api/meeting_type/[id]` | Update title, price, duration, or active status | Yes |
| `DELETE` | `/api/meeting_type/[id]` | Deactivate a meeting type | Yes |

### 6.3 Weekly Availability (`/api/availability`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/availability` | Add weekly day-of-week active hours | Yes |
| `GET` | `/api/availability` | List weekly availability rules | Yes |
| `PATCH` | `/api/availability/[id]` | Update an existing availability window | Yes |
| `DELETE` | `/api/availability/[id]` | Delete an availability window | Yes |

### 6.4 Availability Overrides (`/api/availability_override`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/availability_override` | Add date-specific blockout or custom hours | Yes |
| `GET` | `/api/availability_override` | List all overrides for host | Yes |
| `PATCH` | `/api/availability_override/[id]` | Update a date override | Yes |
| `DELETE` | `/api/availability_override/[id]` | Delete a date override | Yes |

### 6.5 Public Guest Endpoints (`/api/public`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/public/host/[slug]` | Get public host profile and active meeting types | No |
| `GET` | `/api/public/host/[slug]/availability` | Get calculated available slots for a given date | No |
| `POST` | `/api/public/booking` | Create a new booking (Free or Pending Payment) | No |
| `GET` | `/api/public/booking/[id]` | Get booking confirmation receipt details | No |

### 6.6 Host Booking Management (`/api/bookings`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/bookings` | List all bookings for authenticated host | Yes |
| `GET` | `/api/bookings/[id]` | Retrieve specific booking details | Yes |
| `PATCH` | `/api/bookings/[id]` | Mark booking status as `COMPLETED` or `NO_SHOW` | Yes |
| `PATCH` | `/api/bookings/[id]/cancel` | Cancel booking (triggers automated refund if paid) | Yes |
| `PATCH` | `/api/bookings/[id]/reschedule` | Reschedule booking to a new start time | Yes |

### 6.7 Payment Processing (`/api/payments`)
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/payments/create-order` | Generate Razorpay order for pending booking | No |
| `POST` | `/api/payments/verify` | Verify payment signature and confirm booking | No |
| `POST` | `/api/payments/webhook` | Process Razorpay payment & refund webhook events | No (Webhook Secret) |
| `POST` | `/api/payments/reconcile-refund`| Reconcile pending refunds with Razorpay | Yes |

---

## 7. Database Models (Prisma)

- **`User`**: Host account with email, hashed password, unique public slug, and timezone (default `Asia/Kolkata`).
- **`MeetingType`**: Configurable session types with duration, location, price in paise (INR), and active toggle.
- **`AvailabilityRule`**: Recurring weekly working hours (`dayOfWeek` 0–6, `startTime`, `endTime`).
- **`AvailabilityOverride`**: Date-specific rules (`date`, `isBlocked`, optional custom `startTime`/`endTime`, `reason`).
- **`Booking`**: Appointment reservations with `guestName`, `guestEmail`, `startTime`, `endTime`, `status` (`CONFIRMED`, `PENDING_PAYMENT`, `CANCELLED`, `COMPLETED`, `NO_SHOW`), and payment expiry timer.
- **`Payment`**: Transaction records linked to bookings with `razorpayOrderId`, `razorpayPaymentId`, `status`, and refund tracking keys.
- **`BookingNotification`**: Status tracking for automated transactional emails.

---

## 8. Academic & Project Information

- **Project Name:** Appointly
- **Project Type:** Semester 5 Mini Project
- **Academic Session:** 2026–2027
- **Repository:** [https://github.com/abhishek251105/Mini_Project_Sem5_Appointly](https://github.com/abhishek251105/Mini_Project_Sem5_Appointly)
- **Status:** Full-stack implementation complete (Backend APIs + Editorial Frontend UI + Payments + Notifications).

---

© 2026 Appointly. Editorial Appointment Scheduling.
