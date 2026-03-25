-- Seed 20 system categories with Slovak names

INSERT INTO categories (name_sk, name_en, name_hu, slug, icon, color, sort_order, is_system) VALUES
('Potraviny', 'Groceries', 'Élelmiszerbolt', 'groceries', '🛒', '#4ade80', 1, true),
('Reštaurácie', 'Dining', 'Éttermek', 'dining', '🍽️', '#f97316', 2, true),
('Doprava', 'Transport', 'Közlekedés', 'transport', '🚗', '#3b82f6', 3, true),
('Bývanie', 'Housing', 'Lakhatás', 'housing', '🏠', '#8b5cf6', 4, true),
('Energie', 'Utilities', 'Közművek', 'utilities', '⚡', '#eab308', 5, true),
('Nakupovanie', 'Shopping', 'Vásárlás', 'shopping', '🛍️', '#ec4899', 6, true),
('Zábava', 'Entertainment', 'Szórakozás', 'entertainment', '🎬', '#06b6d4', 7, true),
('Zdravie', 'Health', 'Egészség', 'health', '💊', '#ef4444', 8, true),
('Predplatné', 'Subscriptions', 'Előfizetések', 'subscriptions', '📱', '#a855f7', 9, true),
('Úspory', 'Savings', 'Megtakarítások', 'savings', '💰', '#22c55e', 10, true),
('Vzdelávanie', 'Education', 'Oktatás', 'education', '🎓', '#0ea5e9', 11, true),
('Cestovanie', 'Travel', 'Utazás', 'travel', '✈️', '#f59e0b', 12, true),
('Šport', 'Fitness', 'Fitness', 'fitness', '🏋️', '#14b8a6', 13, true),
('Zvieratá', 'Pets', 'Háziállatok', 'pets', '🐕', '#d97706', 14, true),
('Dary', 'Gifts', 'Ajándékok', 'gifts', '🎁', '#e879f9', 15, true),
('Poplatky', 'Fees', 'Díjak', 'fees', '💸', '#64748b', 16, true),
('Prevody', 'Transfers', 'Átutalások', 'transfers', '↔️', '#94a3b8', 17, true),
('Ostatné', 'Other', 'Egyéb', 'other', '📦', '#6b7280', 18, true),
('Príjem – Plat', 'Income – Salary', 'Jövedelem – Fizetés', 'income-salary', '💵', '#16a34a', 19, true),
('Príjem – Ostatné', 'Income – Other', 'Jövedelem – Egyéb', 'income-other', '💵', '#15803d', 20, true);

-- Confirm insert
DO $$
DECLARE
  category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO category_count FROM categories WHERE is_system = true;
  RAISE NOTICE 'Seeded % system categories', category_count;
END $$;
