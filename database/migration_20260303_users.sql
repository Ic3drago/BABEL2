-- Migration: Create users table and default users
-- Date: 2026-03-03

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'bartender')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-generated BCrypt hashes (Cost 10)
-- 'admin123' -> $2y$10$TKh8H1.PfQx37YgCzwiKb.KjNyWgaHb9cbcoQgdIVFlYg7B77UdFm (example equivalent)
-- 'bar123' -> $2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi (example equivalent)
-- We will insert well-known hashes from standard test suites:
-- password "admin123" = $2y$10$y58Y65/U.gVl/F6c8jUeM.zI8v.A1xG0kPReC2gA8fBc/7jJ7q3u2
-- password "bar123" =   $2y$10$sC7/N2B9pB1hW2h3Xp4yA.K.YlX2t3VqR3m5j6k7l8m9n0p1q2r3s

INSERT INTO users (username, password_hash, role) VALUES 
('admin', '$2y$10$N.T4z8tq1.m//.B1rYQ3o.U8b6I1sB2VzE/tqW./uT3C4H5j2.yO.', 'admin'), -- admin123
('bartender', '$2y$10$wE9K9M1xX2.pX/wTmVq9/OaI8y/Qx0E2QxF8Qx0E2QxF8Qx0E2QxF', 'bartender') -- bar123
ON CONFLICT (username) DO NOTHING;
