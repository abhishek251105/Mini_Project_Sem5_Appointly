# Appointly — Appointment Scheduling Platform

Appointly is a full-stack appointment scheduling platform that allows hosts to manage their availability, create meeting types, and accept bookings from guests.

The platform supports free and paid appointments, secure authentication, booking management, email notifications, and online payments through Razorpay.

## 1. Features

### Authentication
- Host registration and login
- JWT-based authentication using secure HTTP cookies
- Authenticated user profile retrieval
- Logout functionality
- Protected API endpoints

### Meeting Management
- Create, view, update, and delete meeting types
- Configure appointment duration, description, and location
- Set free or paid appointment pricing
- Enable or disable meeting types

### Availability Management
- Configure weekly availability
- Define available time ranges for individual weekdays
- Block specific dates or time periods using availability overrides
- Generate available booking slots based on host availability

### Booking Management
- Public booking functionality
- Free and paid appointment booking
- Booking status management
- Cancellation and rescheduling
- Prevention of conflicting confirmed bookings

### Payment Integration
- Razorpay payment order creation
- Server-side payment signature verification
- Payment status tracking
- Razorpay webhook integration
- Refund processing and reconciliation

### Email Notifications
- Transactional email integration using Resend
- Booking-related email notifications

## 2. Technology Stack

| Technology | Purpose |
|---|---|
| Next.js 16 | Application framework and backend API routes |
| TypeScript | Type-safe application development |
| PostgreSQL | Relational database |
| Prisma ORM 7 | Database models, queries, and migrations |
| Tailwind CSS 4 | Frontend styling |
| JOSE | JWT creation and verification |
| Zod | Request validation |
| Razorpay | Online payment processing |
| Resend | Transactional email delivery |

## 3. Prerequisites

Before running Appointly, install:

- Node.js 22 or a compatible supported version
- npm
- PostgreSQL
- Git

You will also need Razorpay Test Mode credentials to test paid appointments and Resend credentials to test email functionality.

## 4. Installation and Setup

### Clone the repository

```bash
git clone https://github.com/abhishek251105/Mini_Project_Sem5_Appointly.git
cd Mini_Project_Sem5_Appointly
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env` file in the project root.

The application requires environment variables for:

- PostgreSQL database connection
- JWT signing and verification
- Razorpay API credentials
- Razorpay webhook verification
- Resend email integration

**Important:** Refer to the environment variable names used in the source code. A complete `.env.example` should be added to the repository before handing it over.

Never commit real passwords, private API keys, or webhook secrets.

### Set up PostgreSQL

Create a local PostgreSQL database named `appointly`, or use another database name and update your connection string accordingly.

Ensure the configured database user has the required permissions.

### Apply Prisma migrations

```bash
npx prisma migrate deploy
```

Generate the Prisma client:

```bash
npx prisma generate
```

For inspecting the database during development:

```bash
npx prisma studio
```

### Start the development server

```bash
npm run dev
```

Open:

http://localhost:3000

### Build for production

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## 5. Authentication

Appointly uses JWT-based authentication.

After successful login, the server issues a session token through an HTTP cookie named `session`.

Protected API endpoints use the cookie to identify the authenticated host.

Frontend requests to protected endpoints must include the session cookie. For cross-origin frontend requests, the browser and backend must also be configured correctly for credentials and CORS.

Sensitive credentials and authentication tokens should not be exposed in client-side code.

## 6. API Documentation

**Development base URL:** `http://localhost:3000`

The following sections document the currently implemented route structure. Exact JSON request fields, status codes, and response schemas should be verified against the corresponding route handlers.

### 6.1 Authentication APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new host |
| POST | `/api/auth/login` | Authenticate a host |
| POST | `/api/auth/logout` | End the current session |
| GET | `/api/auth/me` | Retrieve the authenticated host |
| GET | `/api/protected` | Test a protected endpoint |

**Registration**

`POST /api/auth/register`

Illustrative request:

```json
{
  "name": "Demo Host",
  "email": "host@example.com",
  "password": "ExamplePassword123",
  "timeZone": "Asia/Kolkata"
}
```

The server creates the host account and assigns a unique public slug.

**Login**

`POST /api/auth/login`

Illustrative request:

```json
{
  "email": "host@example.com",
  "password": "ExamplePassword123"
}
```

On successful authentication, the backend establishes a session.

**Current user**

`GET /api/auth/me`

Requires authentication.

Returns the authenticated host's profile information, including their ID, name, email, slug, and time zone.

### 6.2 Meeting Type APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/meeting_type` | Create a meeting type |
| GET | `/api/meeting_type` | List the host's meeting types |
| GET | `/api/meeting_type/[id]` | Retrieve a meeting type |
| PUT | `/api/meeting_type/[id]` | Update a meeting type |
| DELETE | `/api/meeting_type/[id]` | Delete a meeting type |

These are host-management endpoints and require authentication.

**Create meeting type**

`POST /api/meeting_type`

Illustrative request:

```json
{
  "title": "Technical Consultation",
  "description": "One-on-one technical guidance",
  "duration": 30,
  "location": "Google Meet",
  "priceInPaise": 50000,
  "currency": "INR",
  "isActive": true
}
```

Pricing is stored in paise.

For example:

- `0` = Free appointment
- `50000` = ₹500
- `75000` = ₹750

The host can update or deactivate meeting types.

### 6.3 Weekly Availability APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/availability` | Create a weekly availability rule |
| GET | `/api/availability` | List availability rules |
| GET | `/api/availability/[id]` | Retrieve a rule |
| PUT | `/api/availability/[id]` | Update a rule |
| DELETE | `/api/availability/[id]` | Delete a rule |

Requires host authentication.

**Example availability rule**

```json
{
  "dayOfWeek": 1,
  "startTime": "09:00",
  "endTime": "17:00"
}
```

The weekday convention is:

| Value | Day |
|---|---|
| 0 | Sunday |
| 1 | Monday |
| 2 | Tuesday |
| 3 | Wednesday |
| 4 | Thursday |
| 5 | Friday |
| 6 | Saturday |

Times use the `HH:MM` format and are interpreted according to the host's time zone.

### 6.4 Availability Override APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/availability_override` | Create a date-specific override |
| GET | `/api/availability_override` | List overrides |
| GET | `/api/availability_override/[id]` | Retrieve an override |
| PUT | `/api/availability_override/[id]` | Update an override |
| DELETE | `/api/availability_override/[id]` | Delete an override |

Requires host authentication.

Overrides can be used for holidays, leave, and exceptional availability.

**Illustrative request**

```json
{
  "date": "2026-12-25",
  "isBlocked": true,
  "reason": "Christmas holiday"
}
```

For partial-day overrides, the relevant time range can be supplied where supported by the route handler.

### 6.5 Public Host APIs

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/public/host/[slug]` | Retrieve public host information |
| GET | `/api/public/host/[slug]/availability` | Retrieve available booking slots |

These endpoints support the guest-facing booking interface.

**Get host profile**

```http
GET /api/public/host/demo-host
```

**Get available slots**

```http
GET /api/public/host/demo-host/availability?meetingTypeId=MEETING_TYPE_ID&date=2026-11-24
```

The availability endpoint calculates available appointment slots using meeting duration, weekly availability, date overrides, and existing bookings.

Slot timestamps are represented in ISO 8601 format.

### 6.6 Booking APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/public/booking` | Create a guest booking |
| GET | `/api/bookings` | List host bookings |
| GET | `/api/bookings/[id]` | Retrieve booking details |
| POST | `/api/bookings/[id]/cancel` | Cancel a booking |
| POST | `/api/bookings/[id]/reschedule` | Reschedule a booking |

Host booking-management endpoints require authentication.

The public booking endpoint is used by guests.

**Booking workflow**

1. Guest opens a host's public booking page.
2. Guest selects a meeting type.
3. Guest chooses an available date and time.
4. Guest submits the required booking details.
5. Backend validates the requested slot.
6. Free bookings can be confirmed without payment.
7. Paid bookings proceed through the payment workflow.

The exact booking request payload and cancellation/rescheduling authorization rules must be verified against the current implementation.

### 6.7 Payment APIs

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/payments/create-order` | Create a Razorpay payment order |
| POST | `/api/payments/verify` | Verify a payment response |
| POST | `/api/payments/webhook` | Receive Razorpay webhook events |
| POST | `/api/payments/reconcile-refund` | Reconcile a refund with Razorpay |

**Payment workflow**

1. A guest selects a paid appointment.
2. Appointly creates a payment order using Razorpay.
3. The guest completes Razorpay Checkout.
4. The backend verifies the payment response.
5. The payment and booking records are updated.
6. Webhooks help synchronize payment and refund events.

The backend must never trust a browser-side payment success message without server-side verification.

**Refunds**

Refund processing and reconciliation are supported by the backend.

Refund operations must validate the booking/payment relationship and authorization before modifying records.

The refund reconciliation endpoint is intended for authorized host-side use, not unrestricted public access.

### 6.8 Email Testing API

| Method | Endpoint | Description |
|---|---|---|
| GET/POST (verify implementation) | `/api/test-email` | Test email functionality |

This is a development/testing endpoint. Its method and authorization requirements should be checked in the source code.

**Do not expose an unrestricted email-testing endpoint in production.**

## 7. Razorpay Configuration

Appointly currently uses Razorpay Test Mode.

Test Mode allows developers to simulate payments without transferring real money.

### Requirements

- Razorpay Test Key ID
- Razorpay Test Key Secret
- Webhook signing secret
- Correct backend payment verification configuration

### Important security considerations

- Keep Razorpay Key Secret on the server.
- Verify payment signatures server-side.
- Verify webhook signatures.
- Prevent duplicate payment processing.
- Validate appointment availability before confirmation.
- Do not trust payment amounts supplied by the client.
- Reconcile payment and refund states when necessary.

### Switching to Live Mode

Before enabling live payments:

1. Complete Razorpay account activation and verification.
2. Obtain live API credentials.
3. Configure production environment variables.
4. Configure live webhooks.
5. Deploy the application over HTTPS.
6. Test the complete booking, payment, cancellation, and refund flows.

**Note:** Switching to live credentials alone does not implement automatic payouts to individual hosts. Marketplace settlement requirements must be handled separately.

## 8. Database

Appointly uses PostgreSQL with Prisma ORM.

The database stores information related to:

- Host accounts
- Meeting types
- Weekly availability
- Date-specific availability overrides
- Bookings
- Payments and refund tracking

Prisma migrations are stored in the repository and should be applied when setting up a new environment.

Avoid using destructive database migration commands on production data.

## 9. Project Structure

```text
Appointly/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   ├── availability/
│   │   ├── availability_override/
│   │   ├── bookings/
│   │   ├── meeting_type/
│   │   ├── payments/
│   │   └── public/
│   ├── layout.tsx
│   └── page.tsx
├── lib/
├── prisma/
├── public/
├── next.config.ts
├── package.json
├── prisma.config.ts
└── README.md
```

This is a simplified directory overview. The exact file tree may change as the frontend is developed.

## 10. Frontend Integration

The frontend can be built using Next.js and React.

Recommended frontend sections include:

- Host registration and login
- Host dashboard
- Meeting type management
- Weekly availability management
- Availability override management
- Booking management
- Public host booking pages
- Razorpay Checkout integration
- Booking confirmation and payment status screens

Frontend developers should use the existing API endpoints and follow the authentication and validation requirements defined by the backend.

## 11. Testing

The backend APIs have been developed and tested using Thunder Client.

Additional checks include:

- TypeScript validation
- ESLint
- Next.js production build
- Razorpay Test Mode payment flows
- Refund processing and reconciliation

Run:

```bash
npm run lint
npm run build
```

A successful production build does not replace comprehensive integration, security, and deployment testing.

## 12. Future Enhancements

Potential improvements include:

- Calendar integration with Google Calendar
- Automated meeting link generation
- SMS and WhatsApp reminders
- Advanced host analytics
- Subscription plans for premium platform features
- Automatic payouts and marketplace settlement support
- Enhanced notification management
- Mobile application support

## 13. Project Information

**Project Name:** Appointly

**Project Type:** Semester 5 Mini Project

**Academic Session:** 2026–2027

**Repository:** https://github.com/abhishek251105/Mini_Project_Sem5_Appointly

**Current Development Status:** Backend implemented; frontend integration pending.

**Payment Status:** Razorpay Test Mode.

---

Appointly aims to simplify appointment scheduling by providing a centralized platform for availability management, guest bookings, and secure payment processing.
