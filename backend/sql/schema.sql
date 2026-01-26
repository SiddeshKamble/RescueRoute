BEGIN;

DROP TABLE IF EXISTS emergencies CASCADE;
DROP TABLE IF EXISTS responders CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('CITIZEN','RESPONDER')),
  responder_role TEXT NULL CHECK (responder_role IN ('AMBULANCE','POLICE','FIRE')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Responders are FIXED stations (hospital / police station / fire station)
CREATE TABLE responders (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','BUSY','OFFLINE')),
  station_lat DOUBLE PRECISION NOT NULL,
  station_lng DOUBLE PRECISION NOT NULL
);

CREATE TABLE emergencies (
  id UUID PRIMARY KEY,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('AMBULANCE','POLICE','FIRE')),
  description TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ASSIGNED','EN_ROUTE','ON_SCENE','COMPLETED','CANCELLED')),
  assigned_responder_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  route_geojson JSONB,
  eta_seconds INTEGER,
  distance_meters INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_type_role ON users(user_type, responder_role);
CREATE INDEX idx_responders_status ON responders(status);
CREATE INDEX idx_emergencies_assigned ON emergencies(assigned_responder_id);
CREATE INDEX idx_emergencies_status ON emergencies(status);

COMMIT;
