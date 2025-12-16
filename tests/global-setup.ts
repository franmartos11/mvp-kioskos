import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Test Constants - EXPORTED so tests can use them
export const TEST_USER = {
    email: 'e2e_test_user@kioskapp.com',
    password: 'TestPassword123!',
    full_name: 'E2E Test User'
};

export const TEST_KIOSK_NAME = 'E2E Automated Kiosk';
export const TEST_PRODUCT = {
    name: 'E2E Test Soda',
    price: 500,
    cost: 200,
    barcode: 'E2E-123456',
    stock: 100
};

async function globalSetup() {
    console.log('\nStarting Global Setup (Seeding Database)...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    }

    // Use Service Role to bypass RLS for setup
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 1. Ensure Test User Exists
    let userId = '';
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;
    
    const existingUser = users.find(u => u.email === TEST_USER.email);

    if (existingUser) {
        console.log(`- User ${TEST_USER.email} exists.`);
        userId = existingUser.id;
        // Ensure password is correct
        await supabase.auth.admin.updateUserById(userId, { password: TEST_USER.password });
    } else {
        console.log(`- Creating user ${TEST_USER.email}...`);
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: TEST_USER.email,
            password: TEST_USER.password,
            email_confirm: true,
            user_metadata: { full_name: TEST_USER.full_name }
        });
        if (createError) throw createError;
        userId = newUser.user.id;
    }

    // ROBUSTNESS: Upsert Profile manually to fix missing trigger history
    await supabase.from('profiles').upsert({
        id: userId,
        email: TEST_USER.email,
        full_name: TEST_USER.full_name
    });

    // 2. Ensure Kiosk Exists and User is Member
    // Check if kiosk exists for this user
    const { data: kiosks } = await supabase.from('kiosks').select('id').eq('owner_id', userId).eq('name', TEST_KIOSK_NAME);
    let kioskId = '';

    if (kiosks && kiosks.length > 0) {
        console.log(`- Kiosk "${TEST_KIOSK_NAME}" exists.`);
        kioskId = kiosks[0].id;
    } else {
        console.log(`- Creating Kiosk "${TEST_KIOSK_NAME}"...`);
        const { data: newKiosk, error: kError } = await supabase.from('kiosks').insert({
            name: TEST_KIOSK_NAME,
            owner_id: userId
        }).select().single();
        
        if (kError) throw kError;
        kioskId = newKiosk.id;

        // Add Member relation (Owner)
        await supabase.from('kiosk_members').insert({
            kiosk_id: kioskId,
            user_id: userId,
            role: 'owner'
        });
    }

    // 3. Ensure Test Product Exists (Reset Stock)
    const { data: products } = await supabase.from('products')
        .select('id')
        .eq('kiosk_id', kioskId)
        .eq('barcode', TEST_PRODUCT.barcode);

    if (products && products.length > 0) {
        console.log(`- Resetting Product "${TEST_PRODUCT.name}"...`);
        // Reset stock and price to known values
        await supabase.from('products').update({
            stock: TEST_PRODUCT.stock,
            price: TEST_PRODUCT.price,
            cost: TEST_PRODUCT.cost
        }).eq('id', products[0].id);
    } else {
        console.log(`- Creating Product "${TEST_PRODUCT.name}"...`);
        await supabase.from('products').insert({
            name: TEST_PRODUCT.name,
            kiosk_id: kioskId,
            price: TEST_PRODUCT.price,
            cost: TEST_PRODUCT.cost,
            stock: TEST_PRODUCT.stock,
            barcode: TEST_PRODUCT.barcode
        });
    }

    console.log('Global Setup Complete.\n');
}

export default globalSetup;
