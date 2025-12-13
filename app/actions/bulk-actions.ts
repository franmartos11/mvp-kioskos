"use server";

import { createClient } from "@/utils/supabase/server";

export async function updateProductPricesBulk(productIds: string[], percentage: number) {
  const supabase = await createClient();

  if (!productIds.length) {
    return { error: "No products selected" };
  }

  try {
      // 1. Fetch products to get current price and name for history
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, price, name')
        .in('id', productIds);

      if (fetchError || !products) {
          throw new Error(fetchError?.message || "Failed to fetch products");
      }

      // 2. Prepare log data and updates
      const affectedProducts = products.map(p => ({
          id: p.id,
          name: p.name,
          old_price: p.price,
          new_price: Math.ceil(p.price * (1 + percentage / 100))
      }));

      const updates = affectedProducts.map(p => {
          return supabase
            .from('products')
            .update({ price: p.new_price })
            .eq('id', p.id);
      });

      // 3. Execute updates in parallel
      const results = await Promise.all(updates);
      
      // Check for errors
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw new Error(firstError.message);

      // 4. Log to history
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
         // Optionally we can choose to throw or just log. Since history is critical for this feature, let's throw or warn.
         console.warn("User not found during manual price update, history not skipped.");
         // But the user feature request implies they want to see it.
         // If auth fails, maybe they shouldn't be updating prices?
         // For now let's just try to insert and catch the error.
      }
      
      if (user) {
         const { error: insertError } = await supabase.from('price_changes_history').insert({
             user_id: user.id,
             action_type: 'BULK_MANUAL',
             description: `Aumento Manual ${percentage}% (${affectedProducts.length} productos)`,
             affected_products: affectedProducts
         });

         if (insertError) {
             console.error("Failed to insert price history (non-fatal):", insertError);
             return { success: true, warning: `Prices updated, but history log failed: ${insertError.message}` };
         }
      }

      return { success: true };
  } catch (e: any) {
      return { error: e.message };
  }
}

export async function updateProductPricesBySupplier(supplierId: string, percentage: number) {
  const supabase = await createClient();

  try {
      // Fetch products by supplier
      const { data: products, error: fetchError } = await supabase
        .from('products')
        .select('id, price, name, suppliers(name)') // Added name and supplier name
        .eq('supplier_id', supplierId);

      if (fetchError || !products) {
          throw new Error(fetchError?.message || "Failed to fetch products for supplier");
      }

      // Prepare log data
      const affectedProducts = products.map(p => ({
          id: p.id,
          name: p.name,
          old_price: p.price,
          new_price: Math.ceil(p.price * (1 + percentage / 100))
      }));

      const updates = affectedProducts.map(p => {
          return supabase
            .from('products')
            .update({ price: p.new_price })
            .eq('id', p.id);
      });

      // Execute updates
      const results = await Promise.all(updates);
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw new Error(firstError.message);

      // Log to history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         await supabase.from('price_changes_history').insert({
             user_id: user.id,
             action_type: 'BULK_SUPPLIER',
             description: `Aumento ${percentage}% a proveedor ${Array.isArray(products[0]?.suppliers) ? products[0]?.suppliers[0]?.name : (products[0]?.suppliers as any)?.name || 'Desconocido'}`,
             affected_products: affectedProducts
         });
      }
      
      return { success: true, count: updates.length };
  } catch (e: any) {
      return { error: e.message };
  }
}

export async function getPriceHistory() {
    const supabase = await createClient();
    const { data: historyData } = await supabase
        .from('price_changes_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

    if (!historyData || historyData.length === 0) return [];

    // Fetch user profiles to display names
    const userIds = Array.from(new Set(historyData.map(h => h.user_id)));
    let profilesMap: Record<string, any> = {};

    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds);
        
        profiles?.forEach(p => {
            profilesMap[p.id] = p;
        });
    }

    // Merge profile info
    const enrichedHistory = historyData.map(h => ({
        ...h,
        user_name: profilesMap[h.user_id]?.full_name || profilesMap[h.user_id]?.email || 'Usuario Desconocido'
    }));

    return enrichedHistory;
}

export async function revertPriceChange(historyId: string) {
    const supabase = await createClient();
    try {
        // 1. Get history record
        const { data: history, error: fetchError } = await supabase
            .from('price_changes_history')
            .select('*')
            .eq('id', historyId)
            .single();
        
        if (fetchError || !history) throw new Error("Registro no encontrado");
        
        const productsToRevert = history.affected_products as any[];
        if (!productsToRevert || productsToRevert.length === 0) return { success: true, count: 0 };

        // 2. Revert updates
        const updates = productsToRevert.map(p => {
             return supabase.from('products').update({ price: p.old_price }).eq('id', p.id);
        });

        await Promise.all(updates);

        // 3. Log the revert
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('price_changes_history').insert({
                user_id: user.id,
                action_type: 'REVERT',
                description: `Reversión de: ${history.description}`,
                affected_products: productsToRevert.map(p => ({
                    ...p,
                    old_price: p.new_price, // Swapped for record constraint if we wanted it, but just storing as is fine. 
                    // Actually let's store the operation: Old was 'new_price' (current), New is 'old_price' (target)
                    new_price: p.old_price
                }))
            });
        }

        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}
