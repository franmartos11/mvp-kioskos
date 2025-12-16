-- Secure Function to Delete Kiosk and Cascade Data
CREATE OR REPLACE FUNCTION delete_kiosk_fully(target_kiosk_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_is_owner BOOLEAN;
BEGIN
    v_user_id := auth.uid();

    -- 1. Security Check: Must be Owner
    SELECT EXISTS (
        SELECT 1 FROM kiosk_members 
        WHERE kiosk_id = target_kiosk_id AND user_id = v_user_id AND role = 'owner'
    ) INTO v_is_owner;

    IF NOT v_is_owner THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permisos de propietario para eliminar este kiosco.');
    END IF;

    -- 2. Cascade Deletions (Order matters for Foreign Keys)
    
    -- Finance & Shift Management
    DELETE FROM cash_sessions WHERE kiosk_id = target_kiosk_id;
    DELETE FROM expenses WHERE kiosk_id = target_kiosk_id;

    -- Sales & Operations
    -- sale_items depends on sales. Delete items first via subquery or let CASCADE handle it if configured. 
    -- Assuming NO CASCADE on schema, manual delete:
    DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE kiosk_id = target_kiosk_id);
    DELETE FROM sales WHERE kiosk_id = target_kiosk_id;

    -- Inventory & Supply
    DELETE FROM stock_movements WHERE kiosk_id = target_kiosk_id;
    
    -- Supplier Orders (Complex dependency)
    DELETE FROM supplier_order_items WHERE order_id IN (SELECT id FROM supplier_orders WHERE kiosk_id = target_kiosk_id);
    DELETE FROM supplier_payments WHERE kiosk_id = target_kiosk_id;
    DELETE FROM supplier_orders WHERE kiosk_id = target_kiosk_id;
    DELETE FROM suppliers WHERE kiosk_id = target_kiosk_id;

    -- Products & Categories
    -- Products might be referenced implicitly.
    DELETE FROM products WHERE kiosk_id = target_kiosk_id;
    DELETE FROM categories WHERE kiosk_id = target_kiosk_id;

    -- Staff
    DELETE FROM work_shifts WHERE kiosk_id = target_kiosk_id;
    DELETE FROM employees WHERE kiosk_id = target_kiosk_id;

    -- Memberships
    DELETE FROM kiosk_members WHERE kiosk_id = target_kiosk_id;

    -- Finally, the Kiosk itself
    DELETE FROM kiosks WHERE id = target_kiosk_id;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
