
export const MOCK_FLOORS = [
    {
        id: 'f1', number: 1, rooms: [
            {
                id: 'r101', number: '101', capacity: 4, occupied: 2, floor: 1, tenants: [
                    { id: 't1', name: 'Shiva', email: 'shiva@example.com', password: 'password', phone: '+91 98765 43210', rent: 8000, joinDate: '2024-01-15', status: 'Paid' },
                    { id: 't2', name: 'Sharan', email: 'sharan@example.com', password: 'password', phone: '+91 87654 32109', rent: 8000, joinDate: '2024-02-01', status: 'Pending' }
                ]
            },
            { id: 'r102', number: '102', capacity: 4, occupied: 0, floor: 1, tenants: [] },
            {
                id: 'r105', number: '105', capacity: 3, occupied: 1, floor: 1, tenants: [
                    { id: 't7', name: 'Sonia', phone: '+91 99887 76655', rent: 7500, joinDate: '2024-01-10', status: 'Paid' }
                ]
            }
        ]
    },
    {
        id: 'f2', number: 2, rooms: [
            {
                id: 'r201', number: '201', capacity: 4, occupied: 4, floor: 2, tenants: [
                    { id: 't3', name: 'Ajay', phone: '+91 76543 21098', rent: 7500, joinDate: '2023-12-10', status: 'Paid' },
                    { id: 't4', name: 'Pappu', phone: '+91 65432 10987', rent: 7500, joinDate: '2024-01-05', status: 'Paid' },
                    { id: 't5', name: 'Modi', phone: '+91 54321 09876', rent: 7500, joinDate: '2024-01-20', status: 'Pending' },
                    { id: 't9', name: 'Kejriwal', phone: '+91 98765 12345', rent: 7500, joinDate: '2024-02-15', status: 'Pending' }
                ]
            },
            {
                id: 'r204', number: '204', capacity: 2, occupied: 1, floor: 2, tenants: [
                    { id: 't8', name: 'Priyanka', phone: '+91 88990 01122', rent: 9000, joinDate: '2024-02-05', status: 'Paid' }
                ]
            }
        ]
    },
    {
        id: 'f3', number: 3, rooms: [
            {
                id: 'r302', number: '302', capacity: 3, occupied: 1, floor: 3, tenants: [
                    { id: 't6', name: 'Rahul', phone: '+91 43210 98765', rent: 7500, joinDate: '2024-02-12', status: 'Paid' }
                ]
            }
        ]
    }
];

export const MOCK_PAYMENTS = [
    { id: 'pay_1', tenantId: 't1', tenantName: 'Shiva', room: '101', amount: 8000, status: 'paid', date: '2024-02-05', method: 'UPI', month: 'February 2024' },
    { id: 'pay_new', tenantId: 't1', tenantName: 'Shiva', room: '101', amount: 8000, status: 'pending', date: null, method: null, month: 'March 2024' },
    { id: 'pay_2', tenantId: 't2', tenantName: 'Sharan', room: '101', amount: 8000, status: 'pending', date: null, method: null, month: 'February 2024' },
    { id: 'pay_3', tenantId: 't3', tenantName: 'Ajay', room: '201', amount: 7500, status: 'paid', date: '2024-02-01', method: 'Cash', month: 'February 2024' },
    { id: 'pay_4', tenantId: 't5', tenantName: 'Modi', room: '201', amount: 7500, status: 'overdue', date: null, method: null, month: 'January 2024' },
    { id: 'pay_5', tenantId: 't8', tenantName: 'Priyanka', room: '204', amount: 9000, status: 'paid', date: '2024-02-06', method: 'UPI', month: 'February 2024' },
    { id: 'pay_6', tenantId: 't9', tenantName: 'Kejriwal', room: '201', amount: 7500, status: 'pending', date: null, method: null, month: 'February 2024' },
];

export const MOCK_COMPLAINTS = [
    {
        id: 'comp_1',
        tenantName: 'Shiva',
        room: '101',
        title: 'Leaking Tap in Bathroom',
        description: 'The tap in the attached bathroom has been leaking continuously since yesterday morning. It is causing water wastage.',
        date: '2024-02-12',
        status: 'pending',
        priority: 'medium'
    },
    {
        id: 'comp_2',
        tenantName: 'Priyanka',
        room: '204',
        title: 'WiFi Not Working',
        description: 'The WiFi signal is very weak in my room. I am unable to attend online classes.',
        date: '2024-02-11',
        status: 'resolved',
        priority: 'high'
    },
    {
        id: 'comp_3',
        tenantName: 'Rahul',
        room: '302',
        title: 'Fan Making Noise',
        description: 'The ceiling fan makes a loud clicking noise when set to speed 3.',
        date: '2024-02-10',
        status: 'pending',
        priority: 'low'
    },
    {
        id: 'comp_4',
        tenantName: 'Sonia',
        room: '105',
        title: 'Window Latch Broken',
        description: 'The window latch is broken and does not lock properly. Please fix it for safety.',
        date: '2024-02-08',
        status: 'resolved',
        priority: 'high'
    },
    {
        id: 'comp_5',
        tenantName: 'Kejriwal',
        room: '201',
        title: 'Geyser Not Heating',
        description: 'The water geyser is not heating up. The indicator light turns on but water remains cold.',
        date: '2024-02-13',
        status: 'pending',
        priority: 'high'
    },
];

export const MOCK_EXPENSES = [
    { id: 1, title: "Electricity Bill (Jan)", amount: 4500, date: "2024-02-01", category: "Electricity", status: "paid" },
    { id: 2, title: "Water Tank Cleaning", amount: 2000, date: "2024-02-03", category: "Maintenance", status: "paid" },
    { id: 3, title: "Common Area Supplies", amount: 3200, date: "2024-02-05", category: "Other", status: "pending" },
    { id: 4, title: "Morning Tea Supplies", amount: 800, date: "2024-02-06", category: "Food", status: "paid" },
    { id: 5, title: "AC Repair (Room 201)", amount: 3500, date: "2024-02-10", category: "Maintenance", status: "pending" },
    { id: 6, title: "Grocery Shopping", amount: 2800, date: "2024-02-11", category: "Food", status: "paid" },
    { id: 7, title: "Cleaning Supplies", amount: 1200, date: "2024-02-12", category: "Other", status: "pending" },
];

export const MOCK_OWNER = {
    id: 'owner_1',
    name: 'Admin User',
    email: 'admin@trishul.com',
    password: 'admin',
    role: 'owner'
};
