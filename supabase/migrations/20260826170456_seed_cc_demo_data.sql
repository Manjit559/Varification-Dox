/*
# TATA RSA Contact-Centre — Seed Data
Seeds dispositions, break types, demo campaign, queue, and customers.
Marked clearly as demo data via source='seed'.
*/

-- Dispositions
INSERT INTO cc_dispositions (code, label, category, requires_callback, is_final, sort_order) VALUES
  ('connected', 'Connected', 'connected', false, false, 1),
  ('feedback_completed', 'Feedback Completed', 'connected', false, true, 2),
  ('customer_satisfied', 'Customer Satisfied', 'connected', false, true, 3),
  ('customer_dissatisfied', 'Customer Dissatisfied', 'connected', false, true, 4),
  ('complaint_raised', 'Complaint Raised', 'connected', true, true, 5),
  ('escalation_required', 'Escalation Required', 'connected', true, true, 6),
  ('callback_requested', 'Callback Requested', 'connected', true, false, 7),
  ('no_answer', 'No Answer', 'no_contact', false, false, 8),
  ('busy', 'Busy', 'no_contact', false, false, 9),
  ('phone_switched_off', 'Phone Switched Off', 'no_contact', false, false, 10),
  ('out_of_coverage', 'Out of Coverage', 'no_contact', false, false, 11),
  ('call_rejected', 'Call Rejected', 'no_contact', false, false, 12),
  ('invalid_number', 'Invalid Number', 'invalid', false, true, 13),
  ('wrong_number', 'Wrong Number', 'invalid', false, true, 14),
  ('network_failure', 'Network Failure', 'invalid', false, false, 15),
  ('customer_refused_feedback', 'Customer Refused Feedback', 'no_contact', false, true, 16),
  ('dnc', 'DNC / Opt-Out', 'dnc', false, true, 17),
  ('duplicate', 'Duplicate', 'duplicate', false, true, 18)
ON CONFLICT (code) DO NOTHING;

-- Breaks
INSERT INTO cc_breaks (code, label, default_max_minutes, sort_order) VALUES
  ('meal_break', 'Meal Break', 30, 1),
  ('short_break', 'Short Break', 10, 2),
  ('tea_break', 'Tea Break', 10, 3),
  ('personal_break', 'Personal Break', 10, 4),
  ('training', 'Training', 60, 5),
  ('meeting', 'Meeting', 60, 6),
  ('technical_break', 'Technical Break', 15, 7)
ON CONFLICT (code) DO NOTHING;

-- Demo campaign
INSERT INTO cc_campaigns (id, name, description, status, priority, max_attempts, retry_interval_minutes, calling_window_start, calling_window_end, timezone)
VALUES ('a0000000-0000-0000-0000-000000000001', 'TATA RSA PSF Survey Q3 2026', 'Post-service feedback calls for roadside assistance cases', 'active', 3, 3, 60, '09:00', '21:00', 'Asia/Kolkata')
ON CONFLICT (id) DO NOTHING;

-- Demo queue
INSERT INTO cc_queues (id, campaign_id, name, status, priority, calling_window_start, calling_window_end, timezone)
VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'RSA PSF - North Zone', 'on', 3, '09:00', '21:00', 'Asia/Kolkata')
ON CONFLICT (id) DO NOTHING;

-- Demo customers (source='seed' marks as demo data)
INSERT INTO cc_customers (customer_name, phone, alt_phone, email, location, address, vehicle_number, vehicle_model, rsa_case_id, rsa_case_type, rsa_case_status, service_date, service_type, service_partner, dealer_workshop, technician_name, timezone, source) VALUES
  ('Rajesh Kumar', '+919876543210', '+919876543211', 'rajesh.kumar@email.com', 'Delhi NCR', 'A-12, Sector 18, Noida, UP', 'DL01AB1234', 'Tata Nexon', 'RSA-2026-001234', 'Battery Jumpstart', 'Resolved', '2026-08-20 14:30:00+05:30', 'On-site Battery', 'Tata Service Partner - North', 'Tata Motors Noida', 'Suresh Sharma', 'Asia/Kolkata', 'seed'),
  ('Priya Sharma', '+919812345678', null, 'priya.sharma@email.com', 'Mumbai', 'B-45, Bandra West, Mumbai', 'MH02CD5678', 'Tata Harrier', 'RSA-2026-001235', 'Towing Service', 'Resolved', '2026-08-21 10:15:00+05:30', 'Flatbed Towing', 'Tata Service Partner - West', 'Tata Motors Andheri', 'Amit Patel', 'Asia/Kolkata', 'seed'),
  ('Mohammed Iqbal', '+919900112233', '+919900112234', 'm.iqbal@email.com', 'Hyderabad', 'H.No 22, Banjara Hills, Hyderabad', 'TS01EF9012', 'Tata Altroz', 'RSA-2026-001236', 'Tyre Puncture', 'Resolved', '2026-08-22 16:45:00+05:30', 'Tyre Replacement', 'Tata Service Partner - South', 'Tata Motors Banjara', 'Kiran Reddy', 'Asia/Kolkata', 'seed'),
  ('Sneha Reddy', '+919845678901', null, 'sneha.reddy@email.com', 'Bangalore', 'Flat 301, Whitefield, Bangalore', 'KA03GH3456', 'Tata Safari', 'RSA-2026-001237', 'Key Lockout', 'Resolved', '2026-08-23 09:00:00+05:30', 'Key Extraction', 'Tata Service Partner - South', 'Tata Motors Whitefield', 'Lakshmi N', 'Asia/Kolkata', 'seed'),
  ('Arjun Singh', '+919876001122', null, 'arjun.singh@email.com', 'Jaipur', 'House 5, C-Scheme, Jaipur', 'RJ14IJ7890', 'Tata Tigor', 'RSA-2026-001238', 'Fuel Delivery', 'Resolved', '2026-08-24 11:30:00+05:30', 'Emergency Fuel', 'Tata Service Partner - North', 'Tata Motors Jaipur', 'Dinesh Jain', 'Asia/Kolkata', 'seed'),
  ('Fatima Begum', '+919844556677', '+919844556678', 'fatima.b@email.com', 'Kolkata', '7B Park Street, Kolkata', 'WB05KL1122', 'Tata Punch', 'RSA-2026-001239', 'Minor Repair', 'Open', '2026-08-25 13:00:00+05:30', 'On-site Repair', 'Tata Service Partner - East', 'Tata Motors Park Street', 'Subir Das', 'Asia/Kolkata', 'seed'),
  ('Vikram Nair', '+919822334455', null, 'vikram.nair@email.com', 'Kochi', 'T.C 14, Marine Drive, Kochi', 'KL07MN3344', 'Tata Nexon EV', 'RSA-2026-001240', 'EV Charging', 'Resolved', '2026-08-25 15:20:00+05:30', 'Mobile Charging Unit', 'Tata Service Partner - South', 'Tata Motors Kochi', 'Thomas P', 'Asia/Kolkata', 'seed'),
  ('Anjali Gupta', '+919833445566', null, 'anjali.g@email.com', 'Pune', 'C-202, Kothrud, Pune', 'MH12OP5566', 'Tata Tiago', 'RSA-2026-001241', 'Accident Towing', 'Resolved', '2026-08-25 18:00:00+05:30', 'Crane Towing', 'Tata Service Partner - West', 'Tata Motors Kothrud', 'Sanjay M', 'Asia/Kolkata', 'seed')
ON CONFLICT DO NOTHING;

-- Queue items for the demo customers
INSERT INTO cc_queue_items (queue_id, customer_id, status, priority, attempts, max_attempts, next_attempt_at)
SELECT 'b0000000-0000-0000-0000-000000000001', id, 'pending', 5, 0, 3, now()
FROM cc_customers WHERE source = 'seed'
ON CONFLICT DO NOTHING;
