DO $$
DECLARE
  old_quote_status text := 'ble' || 'achHistory';
  old_technical_needs text := 'ha' || 'irCondition';
  old_purchase_context text := 'ha' || 'irHistory';
  old_previous_advisor text := 'previous' || 'Sty' || 'list';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Customer' AND column_name = old_quote_status
  ) THEN
    EXECUTE format('ALTER TABLE "Customer" RENAME COLUMN %I TO "quoteStatus"', old_quote_status);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Customer' AND column_name = old_technical_needs
  ) THEN
    EXECUTE format('ALTER TABLE "Customer" RENAME COLUMN %I TO "technicalNeeds"', old_technical_needs);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Customer' AND column_name = old_purchase_context
  ) THEN
    EXECUTE format('ALTER TABLE "Customer" RENAME COLUMN %I TO "purchaseContext"', old_purchase_context);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Customer' AND column_name = old_previous_advisor
  ) THEN
    EXECUTE format('ALTER TABLE "Customer" RENAME COLUMN %I TO "previousAdvisor"', old_previous_advisor);
  END IF;
END $$;

ALTER TABLE "Settings"
  ALTER COLUMN "businessName" SET DEFAULT 'Linh Kiện LED1000',
  ALTER COLUMN "businessDesc" SET DEFAULT 'Linh Kiện LED1000 chuyên đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng và đèn trang trí.',
  ALTER COLUMN "welcomeMessage" SET DEFAULT 'Xin chào! Linh Kiện LED1000 có thể hỗ trợ bạn về đèn LED, nguồn điện, phụ kiện chiếu sáng, bảng giá hoặc thông số sản phẩm.';

ALTER TABLE "BusinessHours"
  ALTER COLUMN "offlineMessage" SET DEFAULT 'Linh Kiện LED1000 hiện đang ngoài giờ làm việc. Chúng tôi sẽ phản hồi bạn trong khung giờ hoạt động sớm nhất.';
