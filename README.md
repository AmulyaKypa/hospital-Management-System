# Hospital Management System (HMS)

Full-stack web app: **Node.js + Express** REST API, **MongoDB** (Mongoose), **vanilla HTML/CSS/JavaScript** frontend.

Roles: **admin**, **staff**, **doctor**, **patient** (role-based access enforced by the server).

## Prerequisites
| Need | Check |
|---|---|
| Node.js 20 or newer | `node -v` |
| MongoDB running locally (or a MongoDB Atlas connection string) | open MongoDB Compass and connect |

## Run
    npm install
    # Windows PowerShell:
    $env:MONGO_URI="mongodb://localhost:27017/hms3"
    $env:SEED_DEMO="true"
    $env:DEFAULT_ACCOUNT_PASSWORD="set-a-temporary-password"
    $env:HOSPITAL_TZ_OFFSET_MINUTES="330"     # optional: 330 = India time, default is UTC
    npm start
Open **http://localhost:3000** (the pages and the API must come from this same address).

macOS/Linux: `MONGO_URI=mongodb://localhost:27017/hms3 SEED_DEMO=true DEFAULT_ACCOUNT_PASSWORD="set-a-temporary-password" npm start`

## Sign in
On the sign-in page choose your role (Patient, Doctor, Staff or Admin), then enter your username and password. The role must match the account.

| Username | Password | Role |
|---|---|---|
| admin | Admin@12345 | admin |
| staff1 | Demo@12345 | staff |
| doctor1 to doctor8 (eight doctors across General Medicine, Cardiology, Pediatrics, Orthopedics, Dermatology, Gynecology, Neurology, ENT) | Demo@12345 | doctor |
| patient1 (Ravi Kumar, assigned to doctor1) | Demo@12345 | patient |

Demo logins and sample data exist only when `SEED_DEMO=true`. New patients can create an account from the sign-in page; signup creates a linked patient record. When staff/admin add a patient or an admin adds a doctor, the application creates a linked login using the first name as the username (a numeric suffix is added if needed). Set `DEFAULT_ACCOUNT_PASSWORD` to a temporary password of at least 8 characters; generated credentials are shown once after creation. Ask users to change this password after signing in. Doctor, staff and admin accounts are created by an administrator.
Change all passwords and set `JWT_SECRET` before using this for anything real.

## Try the main flow (5 minutes)
1. Sign in as **patient1**, open Appointments, request a slot with Dr. Meera Rao on a weekday (30-minute slots).
2. Sign out, sign in as **doctor1**, open Appointments, **Approve** it, then **Complete** it (a consultation bill is generated from the doctor's fee).
3. As doctor1 open Patients, then Records for Ravi Kumar: add a diagnosis/prescription and a lab report.
4. Sign in as **staff1**: Billing shows the bill; record a payment and watch the status go unpaid, partial, paid. Reports downloads CSV files.
5. Sign in as **admin**: the Dashboard shows patients, doctors, appointments and revenue.

## Features
| Prompt requirement | Where |
|---|---|
| Admin / doctor / patient login, role-based access | `routes/auth.js`, `middleware/auth.js` |
| Register patients, history (diagnosis, prescriptions, lab reports) | `routes/patients.js`, `models/Patient.js` |
| Search and filter by ID, name, condition | `GET /api/patients?q=` |
| Doctor profiles, availability, assign patients to doctors | `routes/doctors.js`; assignment is the "Assigned doctor" field on a patient |
| Doctor schedules and appointments | Appointments page (filter by status and date) |
| Online booking, doctor approve/reject, admin manages all | `routes/appointments.js` |
| Bills for consultations, treatments, tests; payment status | `routes/bills.js` (unpaid, partial, paid) |
| Admin dashboard (patients, doctors, revenue) | `routes/dashboard.js` |
| Export reports (daily appointments, patient records) | `routes/reports.js` (CSV; billing report too) |
| Indexes for fast queries | see `docs/API.md` |

Also included: bcrypt passwords, revocable sessions, 15-minute inactivity logout, audit trail, rate limiting, hardened headers, NoSQL-injection filter.

## Documentation
- `docs/API.md`: endpoint reference, collections and indexes
- `docs/USER_MANUAL.md`: how each role uses the system
- `docs/hms.postman_collection.json`: import into Postman (run **Login** first; it stores the token)

## Notes and limits
- IDs: patients `P001`, doctors `D001`, appointments `A001`, bills `B001`. A doctor's appointment list is looked up from the Appointment collection instead of being copied into the doctor document, so it can never go out of sync.
- Weekdays and "today" use hospital local time (`HOSPITAL_TZ_OFFSET_MINUTES`). Set it to 330 for India, otherwise early-morning bookings can land on the wrong weekday.
- Search matches substrings, which MongoDB cannot fully serve from an index; fine for thousands of patients, use a text index beyond that.
- Standalone MongoDB has no multi-document transactions: steps that touch several records undo themselves if a later step fails.
- Not included: file uploads for lab reports (results are text), email/SMS notifications, online payment gateway.

## Environment variables
PORT, MONGO_URI, JWT_SECRET, IDLE_MINUTES (15), TOKEN_HOURS (8), ADMIN_USERNAME, ADMIN_PASSWORD, DEFAULT_ACCOUNT_PASSWORD, SEED_DEMO, HOSPITAL_TZ_OFFSET_MINUTES (0). See `.env.example`.
