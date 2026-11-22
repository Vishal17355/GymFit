CREATE TABLE IF NOT EXISTS gymfit_accounts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('MEMBER', 'TRAINER', 'GYM_OWNER', 'PLATFORM_ADMIN') NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (id),
    UNIQUE KEY gymfit_accounts_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_account_workout_drafts (
    account_id BIGINT NOT NULL,
    draft_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    payload JSON NOT NULL,
    PRIMARY KEY (account_id, draft_key),
    FOREIGN KEY (account_id) REFERENCES gymfit_accounts (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_account_invitations (
    token_hash BINARY(32) NOT NULL,
    email VARCHAR(254) NOT NULL,
    role ENUM('MEMBER', 'TRAINER', 'GYM_OWNER', 'PLATFORM_ADMIN') NOT NULL,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (token_hash)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_platform_tiers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    monthly_price DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_gyms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    tier_id BIGINT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (tier_id) REFERENCES gymfit_platform_tiers (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_branches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    gym_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    address VARCHAR(250) NOT NULL,
    UNIQUE (gym_id, name),
    FOREIGN KEY (gym_id) REFERENCES gymfit_gyms (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_affiliations (
    account_id BIGINT PRIMARY KEY,
    gym_id BIGINT NOT NULL,
    branch_id BIGINT,
    trainer_id BIGINT,
    FOREIGN KEY (account_id) REFERENCES gymfit_accounts (id),
    FOREIGN KEY (gym_id) REFERENCES gymfit_gyms (id),
    FOREIGN KEY (branch_id) REFERENCES gymfit_branches (id),
    FOREIGN KEY (trainer_id) REFERENCES gymfit_affiliations (account_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_workspace_invitations (
    token_hash BINARY(32) PRIMARY KEY,
    gym_id BIGINT NOT NULL,
    branch_id BIGINT,
    FOREIGN KEY (token_hash) REFERENCES gymfit_account_invitations (token_hash) ON DELETE CASCADE,
    FOREIGN KEY (gym_id) REFERENCES gymfit_gyms (id),
    FOREIGN KEY (branch_id) REFERENCES gymfit_branches (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_membership_tiers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    gym_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    term_days INT NOT NULL,
    price DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (gym_id, name),
    FOREIGN KEY (gym_id) REFERENCES gymfit_gyms (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_memberships (
    member_id BIGINT PRIMARY KEY,
    tier_id BIGINT NOT NULL,
    valid_until DATE NOT NULL,
    pass_code CHAR(36) NOT NULL UNIQUE,
    FOREIGN KEY (member_id) REFERENCES gymfit_affiliations (account_id),
    FOREIGN KEY (tier_id) REFERENCES gymfit_membership_tiers (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_membership_operations (
    operation_id CHAR(36) PRIMARY KEY,
    member_id BIGINT NOT NULL,
    recorded_by BIGINT NOT NULL,
    tier_id BIGINT NOT NULL,
    FOREIGN KEY (member_id) REFERENCES gymfit_affiliations (account_id),
    FOREIGN KEY (recorded_by) REFERENCES gymfit_accounts (id),
    FOREIGN KEY (tier_id) REFERENCES gymfit_membership_tiers (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_checkins (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,
    checked_in_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES gymfit_memberships (member_id),
    FOREIGN KEY (branch_id) REFERENCES gymfit_branches (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    recorded_by BIGINT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL,
    method VARCHAR(20) NOT NULL,
    reference VARCHAR(120) NOT NULL,
    paid_at DATETIME NOT NULL,
    UNIQUE (member_id, reference),
    FOREIGN KEY (member_id) REFERENCES gymfit_affiliations (account_id),
    FOREIGN KEY (recorded_by) REFERENCES gymfit_accounts (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_classes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    gym_id BIGINT NOT NULL,
    branch_id BIGINT NOT NULL,
    trainer_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    starts_at DATETIME NOT NULL,
    capacity INT NOT NULL,
    cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    FOREIGN KEY (gym_id) REFERENCES gymfit_gyms (id),
    FOREIGN KEY (branch_id) REFERENCES gymfit_branches (id),
    FOREIGN KEY (trainer_id) REFERENCES gymfit_affiliations (account_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_reservations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    class_id BIGINT NOT NULL,
    member_id BIGINT NOT NULL,
    status ENUM('BOOKED', 'WAITLISTED', 'ATTENDED', 'ABSENT') NOT NULL,
    UNIQUE (class_id, member_id),
    FOREIGN KEY (class_id) REFERENCES gymfit_classes (id),
    FOREIGN KEY (member_id) REFERENCES gymfit_affiliations (account_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_assigned_plans (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    assigned_by BIGINT NOT NULL,
    kind ENUM('WORKOUT', 'DIET') NOT NULL,
    title VARCHAR(120) NOT NULL,
    details TEXT NOT NULL,
    workout JSON,
    nutrition JSON,
    assigned_at DATETIME NOT NULL,
    UNIQUE (member_id, kind),
    FOREIGN KEY (member_id) REFERENCES gymfit_affiliations (account_id),
    FOREIGN KEY (assigned_by) REFERENCES gymfit_accounts (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_profiles (
    member_id BIGINT PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    goal VARCHAR(250) NOT NULL,
    FOREIGN KEY (member_id) REFERENCES gymfit_accounts (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_training_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    kind ENUM('MEASUREMENT', 'SET', 'HOME', 'MEAL') NOT NULL,
    label VARCHAR(120) NOT NULL,
    details JSON NOT NULL,
    recorded_at DATETIME NOT NULL,
    INDEX (member_id, kind, id),
    FOREIGN KEY (member_id) REFERENCES gymfit_accounts (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gymfit_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT NOT NULL,
    gym_id BIGINT,
    event VARCHAR(120) NOT NULL,
    subject VARCHAR(250) NOT NULL,
    recorded_at DATETIME NOT NULL,
    acknowledged_at DATETIME,
    acknowledged_by BIGINT,
    FOREIGN KEY (actor_id) REFERENCES gymfit_accounts (id),
    FOREIGN KEY (gym_id) REFERENCES gymfit_gyms (id),
    FOREIGN KEY (acknowledged_by) REFERENCES gymfit_accounts (id)
) ENGINE=InnoDB;
