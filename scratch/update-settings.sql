UPDATE "Settings"
SET
  "businessName" = 'Minh Hy Hair',
  "businessDesc" = 'Salon tóc nữ chuyên nghiệp - Cắt, Nhuộm, Uốn, Duỗi, Highlight, Balayage và Phục hồi tóc',
  "tone" = 'friendly',
  "language" = 'auto'
WHERE id = 'default';

-- If no row exists yet, insert it
INSERT INTO "Settings" (id, "businessName", "businessDesc", "tone", "language", "aiProvider", "aiModel")
SELECT 'default', 'Minh Hy Hair',
  'Salon tóc nữ chuyên nghiệp - Cắt, Nhuộm, Uốn, Duỗi, Highlight, Balayage và Phục hồi tóc',
  'friendly', 'auto', 'gemini', 'gemini-2.0-flash'
WHERE NOT EXISTS (SELECT 1 FROM "Settings" WHERE id = 'default');
