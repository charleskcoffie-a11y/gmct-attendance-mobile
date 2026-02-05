-- Sample class leaders data
-- Replace these with actual class leader information
-- Password should be hashed in production, but stored as plaintext for now

-- Example: Class 1 leader with password "password123"
INSERT INTO class_leaders (class_number, password, full_name, email, phone, active)
VALUES (1, 'password123', 'John Smith', 'john@example.com', '555-0101', true)
ON CONFLICT (class_number) DO NOTHING;

-- Example: Class 2 leader with password "password456"
INSERT INTO class_leaders (class_number, password, full_name, email, phone, active)
VALUES (2, 'password456', 'Jane Doe', 'jane@example.com', '555-0102', true)
ON CONFLICT (class_number) DO NOTHING;

-- Example: Class 3 leader with password "password789"
INSERT INTO class_leaders (class_number, password, full_name, email, phone, active)
VALUES (3, 'password789', 'Mike Johnson', 'mike@example.com', '555-0103', true)
ON CONFLICT (class_number) DO NOTHING;

-- To add more class leaders, use the admin panel in the Settings page
-- Or execute similar INSERT statements for each class
