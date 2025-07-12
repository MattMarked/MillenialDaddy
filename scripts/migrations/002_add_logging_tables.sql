-- Add system logging table
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT (UUID()),
  level VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  context JSON,
  source VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_level (level),
  INDEX idx_created_at (created_at),
  INDEX idx_source (source)
);

-- Add performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT (UUID()),
  operation VARCHAR(100) NOT NULL,
  duration_ms INT NOT NULL,
  context JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operation (operation),
  INDEX idx_created_at (created_at)
);

-- Add system health checks table
CREATE TABLE IF NOT EXISTS health_checks (
  id UUID PRIMARY KEY DEFAULT (UUID()),
  service VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  response_time_ms INT,
  error_message TEXT,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_service (service),
  INDEX idx_checked_at (checked_at)
);

-- Add alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT (UUID()),
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  source VARCHAR(100) NOT NULL,
  context JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP NULL,
  acknowledged_by VARCHAR(255) NULL,
  INDEX idx_type (type),
  INDEX idx_source (source),
  INDEX idx_created_at (created_at),
  INDEX idx_acknowledged (acknowledged)
);