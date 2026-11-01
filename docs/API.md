# API reference

Base URL `http://localhost:3000/api`. JSON in, JSON out. Every endpoint except `/health` and `/auth/login` needs the header `Authorization: Bearer <token>`.
Money is always a **whole number of paise** (Rs 150.50 = `15050`). Errors look like `{ "error": "message" }` with status 400, 401, 403, 404 or 409.
"admin" may call every endpoint, so it is not repeated in the Roles column.

## Auth
| Method and path | Roles | Body | Result |
|---|---|---|---|
| POST /auth/login | public | `username`, `password`, `role` (patient, doctor, staff or admin; must match the account) | `{ token, user }` |
| POST /auth/register | public | `username`, `password`, `fullName`, `age`, `gender`, `contact`; optional `address` | creates a patient record and linked patient login; sign in afterward |
| POST /auth/logout | any | | revokes this session |
| GET /auth/me | any | | current user, `idleMinutes` |

## Patients
| Method and path | Roles | Notes |
|---|---|---|
| GET /patients?q= | any | `q` matches patient ID, name or condition. Doctors see only assigned patients, patients only themselves |
| POST /patients | staff | `name, age, gender, contact` required; optional `address, bloodGroup, allergies, condition, assignedDoctor`; requires `DEFAULT_ACCOUNT_PASSWORD`, creates a linked patient login and returns one-time `login: { username, password }` credentials |
| GET /patients/:id | any with access | full record with `medicalHistory` and `labReports` |
| PUT /patients/:id | staff | same fields; `assignedDoctor` assigns the patient to a doctor |
| DELETE /patients/:id | admin | deletes the patient and deactivates/revokes any linked login |
| POST /patients/:id/history | doctor (assigned) | `diagnosis` required; `prescription, notes, date` |
| POST /patients/:id/lab-reports | doctor (assigned), staff | `testName, result` required; `notes, date` |

## Doctors
| Method and path | Roles | Notes |
|---|---|---|
| GET /doctors | any | |
| POST /doctors | admin | `name, specialization, contact`; optional `fee` (paise), `availability` (e.g. `["Mon","Wed"]`); requires `DEFAULT_ACCOUNT_PASSWORD`, creates a linked doctor login and returns one-time `login: { username, password }` credentials |
| PUT /doctors/:id | admin, or the doctor themself | a doctor may change only `contact` and `availability` |

## Appointments
Status flow: `pending` -> `approved`; `pending` or `approved` -> `rejected` (doctor) or `cancelled` (patient/staff); `approved` -> `completed`. A doctor can also reschedule a pending or approved appointment, which leaves it `approved` at the new time.
| Method and path | Roles | Notes |
|---|---|---|
| GET /appointments?status=&date=YYYY-MM-DD | any | patients see theirs, doctors see theirs, staff/admin see all |
| POST /appointments | patient, staff | `doctor`, `date` (ISO), optional `reason`; staff also send `patient`. Must be in the future, on a 30-minute boundary, on a day the doctor is available. A taken slot returns 409 |
| POST /appointments/:id/approve | doctor (own) | pending only |
| POST /appointments/:id/reject | doctor (own) | pending or approved; optional `note` |
| POST /appointments/:id/reschedule | doctor (own) | pending or approved; body `date` (ISO), optional `note`. Same rules as booking (future, 30-minute slot, doctor available that weekday). Status becomes approved; the old time is kept in `rescheduledFrom`. A taken slot returns 409 |
| POST /appointments/:id/complete | doctor (own) | approved only; creates a consultation bill from the doctor's fee; returns `{ appointment, billId }` |
| POST /appointments/:id/cancel | patient (own), staff | pending or approved |

## Bills
| Method and path | Roles | Notes |
|---|---|---|
| GET /bills?status=&patient= | staff, patient | patients see only their own |
| GET /bills/:id | staff, patient (own) | |
| POST /bills | staff | `patient`, `items: [{ category, description, quantity, unitPrice }]`; category is consultation, treatment, test or other |
| POST /bills/:id/pay | staff | `amount` (paise); cannot exceed the balance; status becomes partial or paid |

## Dashboard and reports
| Method and path | Roles | Result |
|---|---|---|
| GET /dashboard | any | `{ stats: [{ label, value, type }] }`, different per role |
| GET /reports/appointments.csv?date= | staff | daily appointments (default today) |
| GET /reports/patients.csv | staff | patient records |
| GET /reports/bills.csv | staff | billing and revenue |

## Admin
| Method and path | Roles | Notes |
|---|---|---|
| GET /users | admin | |
| POST /users | admin | `username, fullName, role, password`; role doctor needs `doctor` (profile id), role patient needs `patient` (record id) |
| PATCH /users/:id | admin | `fullName`, `active`, `password` |
| POST /users/:id/revoke-sessions | admin | signs the user out everywhere |
| GET /audit?limit= | admin | latest changes and failed requests |

## Collections and indexes
| Collection | Main fields | Indexes |
|---|---|---|
| users | username, passwordHash, role, active, doctor, patient | username (unique) |
| sessions | user, revoked, lastActivity, expiresAt | user; expiresAt (TTL, auto-deletes) |
| patients | patientId, name, age, gender, contact, address, bloodGroup, allergies, condition, assignedDoctor, medicalHistory[], labReports[] | patientId (unique), name, condition, assignedDoctor |
| doctors | doctorId, name, specialization, contact, fee, availability[] | doctorId (unique), specialization |
| appointments | appointmentId, patient, doctor, date, reason, status, holdsSlot, note | appointmentId (unique); (doctor, date) unique where holdsSlot is true, which prevents double booking; (patient, date); date; status |
| bills | billId, patient, items[], total, paid, status, payments[] | billId (unique), (patient, createdAt), status |
| auditlogs | user, username, role, method, path, status, at | at |
| counters | _id, seq | generates P001, D001, A001, B001 atomically |
