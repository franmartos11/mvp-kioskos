export const PLANS = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        kiosks: 1,
        features: ['Hasta 50 productos', '1 Kiosco', 'Reportes Básicos'],
        description: 'Para pequeños emprendedores'
    },
    pro: {
        id: 'pro',
        name: 'Pro',
        price: 18000,
        kiosks: 2,
        features: ['Productos Ilimitados', 'Hasta 2 Kioscos', 'Reportes', 'Soporte'],
        description: 'Negocios en crecimiento'
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 55000,
        kiosks: 999, // unlimited
        features: ['Kioscos Ilimitados', 'Usuarios Ilimitados', 'Productos Ilimitados', 'Reportes Avanzados', 'Soporte Prioritario', 'Dashboards a Medida'],
        description: 'Redes y Franquicias'
    }
} as const;

export type PlanId = keyof typeof PLANS;
