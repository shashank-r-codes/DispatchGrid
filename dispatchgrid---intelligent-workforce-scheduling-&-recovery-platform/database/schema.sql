-- DISPATCHGRID RELATIONAL DATABASE SCHEMA (MySQL 8.0+ / MariaDB)
-- Production DDL with Foreign Keys, Constraints, and Indexes

CREATE DATABASE IF NOT EXISTS dispatchgrid CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dispatchgrid;

-- 1. USERS & AUTHENTICATION TABLE
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(36) PRIMARY KEY,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('CUSTOMER', 'TECHNICIAN', 'ADMIN') NOT NULL,
    account_status ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role)
) ENGINE=InnoDB;

-- 2. CUSTOMER PROFILES & ADDRESSES
CREATE TABLE IF NOT EXISTS customer_profiles (
    customer_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    profile_picture_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customer_addresses (
    address_id VARCHAR(36) PRIMARY KEY,
    customer_id VARCHAR(36) NOT NULL,
    label VARCHAR(50) NOT NULL DEFAULT 'Home',
    address_line TEXT NOT NULL,
    city VARCHAR(80) NOT NULL,
    state VARCHAR(80) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_address_customer (customer_id)
) ENGINE=InnoDB;

-- 3. TECHNICIAN PROFILES
CREATE TABLE IF NOT EXISTS technician_profiles (
    technician_id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL UNIQUE,
    experience_years INT NOT NULL DEFAULT 1,
    service_categories VARCHAR(255) NOT NULL COMMENT 'Comma-separated: Electrical,AC,Plumbing',
    verification_status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    verification_notes TEXT,
    verified_at TIMESTAMP NULL,
    residential_address TEXT NOT NULL,
    city VARCHAR(80) NOT NULL,
    pincode VARCHAR(20) NOT NULL,
    current_latitude DECIMAL(10, 7) NOT NULL,
    current_longitude DECIMAL(10, 7) NOT NULL,
    service_areas TEXT NOT NULL COMMENT 'JSON array or comma-separated areas',
    availability_status ENUM('AVAILABLE', 'BUSY', 'UNAVAILABLE', 'ON_BREAK') NOT NULL DEFAULT 'AVAILABLE',
    working_days VARCHAR(50) NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri',
    shift_start_time VARCHAR(10) NOT NULL DEFAULT '08:00',
    shift_end_time VARCHAR(10) NOT NULL DEFAULT '18:00',
    reserved_emergency_capacity VARCHAR(50) DEFAULT '11:00-11:30',
    total_completed_jobs INT NOT NULL DEFAULT 0,
    average_rating DECIMAL(3, 2) NOT NULL DEFAULT 5.0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_tech_verification (verification_status),
    INDEX idx_tech_availability (availability_status)
) ENGINE=InnoDB;

-- 4. SKILLS & CERTIFICATIONS
CREATE TABLE IF NOT EXISTS skills (
    skill_id VARCHAR(36) PRIMARY KEY,
    category ENUM('Electrical', 'AC', 'Plumbing') NOT NULL,
    skill_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS certifications (
    certification_id VARCHAR(36) PRIMARY KEY,
    category ENUM('Electrical', 'AC', 'Plumbing') NOT NULL,
    certification_name VARCHAR(120) NOT NULL UNIQUE,
    issuing_authority VARCHAR(120),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS technician_skills (
    technician_id VARCHAR(36) NOT NULL,
    skill_id VARCHAR(36) NOT NULL,
    years_experience INT DEFAULT 1,
    PRIMARY KEY (technician_id, skill_id),
    FOREIGN KEY (technician_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS technician_certifications (
    id VARCHAR(36) PRIMARY KEY,
    technician_id VARCHAR(36) NOT NULL,
    certification_id VARCHAR(36) NOT NULL,
    certificate_number VARCHAR(100),
    expiry_date DATE,
    FOREIGN KEY (technician_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (certification_id) REFERENCES certifications(certification_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. SERVICE CATALOGUE
CREATE TABLE IF NOT EXISTS services (
    service_id VARCHAR(36) PRIMARY KEY,
    service_name VARCHAR(120) NOT NULL,
    category ENUM('Electrical', 'AC', 'Plumbing') NOT NULL,
    description TEXT NOT NULL,
    estimated_duration_minutes INT NOT NULL DEFAULT 60,
    indicative_price DECIMAL(10, 2) NOT NULL DEFAULT 49.99,
    required_skills TEXT NOT NULL COMMENT 'JSON array of skill IDs or names',
    required_certifications TEXT COMMENT 'JSON array of certification IDs or names',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. BOOKINGS & APPOINTMENTS
CREATE TABLE IF NOT EXISTS bookings (
    booking_id VARCHAR(36) PRIMARY KEY,
    booking_reference VARCHAR(20) NOT NULL UNIQUE,
    customer_id VARCHAR(36) NOT NULL,
    service_id VARCHAR(36) NOT NULL,
    assigned_technician_id VARCHAR(36) NULL,
    requested_priority ENUM('NORMAL', 'HIGH', 'EMERGENCY') NOT NULL DEFAULT 'NORMAL',
    verified_priority ENUM('NORMAL', 'HIGH', 'EMERGENCY') NOT NULL DEFAULT 'NORMAL',
    priority_verified_by VARCHAR(36) NULL,
    booking_status ENUM(
        'REQUESTED',
        'UNDER_REVIEW',
        'ACCEPTED',
        'SCHEDULED',
        'TECHNICIAN_ACCEPTED',
        'ON_THE_WAY',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'REJECTED'
    ) NOT NULL DEFAULT 'REQUESTED',
    problem_description TEXT NOT NULL,
    photo_url TEXT,
    service_address TEXT NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    node_id VARCHAR(50) NOT NULL COMMENT 'Road network node ID for Dijkstra',
    preferred_date DATE NOT NULL,
    preferred_start_time VARCHAR(10) NOT NULL,
    preferred_end_time VARCHAR(10) NOT NULL,
    alternative_window TEXT,
    preferred_technician_id VARCHAR(36) NULL,
    confirmed_start_time TIMESTAMP NULL,
    confirmed_end_time TIMESTAMP NULL,
    estimated_travel_time_minutes INT DEFAULT 0,
    actual_start_time TIMESTAMP NULL,
    actual_end_time TIMESTAMP NULL,
    completion_notes TEXT,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (service_id) REFERENCES services(service_id) ON DELETE RESTRICT,
    FOREIGN KEY (assigned_technician_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_booking_status (booking_status),
    INDEX idx_booking_priority (verified_priority),
    INDEX idx_booking_technician (assigned_technician_id)
) ENGINE=InnoDB;

-- 7. BOOKING AUDIT & STATUS HISTORY
CREATE TABLE IF NOT EXISTS booking_status_history (
    history_id VARCHAR(36) PRIMARY KEY,
    booking_id VARCHAR(36) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by_user_id VARCHAR(36) NOT NULL,
    change_reason TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS booking_admin_notes (
    note_id VARCHAR(36) PRIMARY KEY,
    booking_id VARCHAR(36) NOT NULL,
    admin_user_id VARCHAR(36) NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. ASSIGNMENT ENGINE EXPLAINABILITY RECORDS
CREATE TABLE IF NOT EXISTS assignment_records (
    record_id VARCHAR(36) PRIMARY KEY,
    scheduling_run_id VARCHAR(36) NOT NULL,
    booking_id VARCHAR(36) NOT NULL,
    assigned_technician_id VARCHAR(36) NOT NULL,
    calculated_travel_time_minutes INT NOT NULL,
    assignment_score DECIMAL(10, 4) NOT NULL,
    selection_reason TEXT NOT NULL,
    evaluated_candidates JSON NOT NULL,
    rejected_alternatives JSON NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. DYNAMIC RECOVERY AUDIT LOGS
CREATE TABLE IF NOT EXISTS recovery_audit_logs (
    recovery_id VARCHAR(36) PRIMARY KEY,
    disruption_type ENUM(
        'TECHNICIAN_SICKNESS',
        'VEHICLE_BREAKDOWN',
        'JOB_DELAY',
        'EMERGENCY_REQUEST',
        'JOB_CANCELLATION',
        'WEATHER_ROAD_CLOSURE'
    ) NOT NULL,
    affected_technician_id VARCHAR(36) NULL,
    affected_booking_ids JSON NOT NULL,
    previous_assignments JSON NOT NULL,
    revised_assignments JSON NOT NULL,
    reason TEXT NOT NULL,
    execution_time_ms INT NOT NULL,
    status ENUM('SUCCESS', 'PARTIAL', 'FAILED') NOT NULL,
    notifications_sent JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 10. REVIEWS & FEEDBACK
CREATE TABLE IF NOT EXISTS reviews (
    review_id VARCHAR(36) PRIMARY KEY,
    booking_id VARCHAR(36) NOT NULL UNIQUE,
    customer_id VARCHAR(36) NOT NULL,
    technician_id VARCHAR(36) NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    service_quality_tags VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (technician_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. IN-APP NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    notification_id VARCHAR(36) PRIMARY KEY,
    recipient_user_id VARCHAR(36) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(36),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipient_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_user_notifications (recipient_user_id, is_read)
) ENGINE=InnoDB;
