CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL, -- Rent, Salary, Electricity, etc.
  amount REAL NOT NULL CHECK(amount >= 0),
  date TEXT NOT NULL,    -- YYYY-MM-DD
  payment_mode TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
