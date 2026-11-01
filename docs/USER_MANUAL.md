# User manual

Open http://localhost:3000, choose your role (Patient, Doctor, Staff or Admin), and sign in with your username and password. After 15 minutes without activity you are signed out automatically. The menu on the left only shows pages your role can use.

## Patients
- **Getting an account:** choose **Create an account** on the sign-in page and provide your name, username, password and patient details. After signup, sign in with your new username and password. If staff/admin register you, they will provide your generated username and temporary password. Doctor, staff and admin accounts must be created by an administrator.
- **Book an appointment:** Appointments, choose a doctor (their available days are listed), pick a date and time on the hour or half hour, add a reason, and press Request appointment. The request stays **pending** until the doctor approves it. The doctor may also reject it or move it to another time; check the Status and Note columns for the outcome. You can cancel pending or approved appointments.
- **Prescriptions and history:** My Health shows your details, diagnoses, prescriptions and lab reports.
- **Bills:** Billing lists your bills with their payment status (unpaid, partial, paid). Press View items to see what each bill includes. Payments are recorded at the hospital desk.

## Doctors
- **Dashboard:** your patients, appointments waiting for approval, today's appointments.
- **Appointments:** Approve a pending request, or **Reject** it (with an optional reason). You can also reject an appointment you already approved. **Reschedule** moves a pending or approved appointment to a new time you choose (on a day you are available, in a 30-minute slot, with an optional message); it becomes approved at the new time and the patient sees "Rescheduled from ..." in their Appointments page. After the visit press Complete, which creates the consultation bill. Use the status and date filters to see your schedule.
- **Patients:** shows only patients assigned to you. Records opens a patient's file where you can add a diagnosis and prescription, and lab reports.
- **Doctors:** update the days you are available and your contact number.

## Staff
- **Patients:** register patients, edit details, assign a doctor, search by ID, name or condition, add lab reports. Registration creates a linked login; give the displayed username and temporary password to the patient.
- **Appointments:** book or cancel appointments for any patient.
- **Billing:** Generate bill takes one item per line as `category, description, quantity, price` (price in rupees), for example `test, Blood sugar, 1, 150`. Record payment updates the status.
- **Reports:** download CSV files for daily appointments, patient records and billing.

## Admin
Everything staff and doctors can do, plus:
- **Doctors:** add a doctor (a linked login is created automatically), edit any profile. Give the doctor the displayed username and temporary password.
- **Administration:** create staff/admin logins, deactivate users, reset passwords, sign a user out everywhere, and read the audit trail. Patient and doctor logins are created automatically when their profiles are registered.
- **Patients:** delete a patient (this removes their whole record).
- **Dashboard:** hospital statistics including revenue collected, total billed and outstanding.
