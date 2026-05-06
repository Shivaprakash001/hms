const { z } = require("zod");

const TenantProfileUpdateSchema = z.object({
  name: z.string().optional(),
  year_of_study: z.union([z.coerce.number().int().min(1).max(6), z.literal(0)]).optional().nullable(),
  photo_url: z.string().optional().nullable(),
});

const payload1 = {
  name: "John",
  year_of_study: null,
  photo_url: "data:image/jpeg;base64,12345"
};

const payload2 = {
  name: "Jane",
  year_of_study: 3,
};

const res1 = TenantProfileUpdateSchema.safeParse(payload1);
if (!res1.success) console.error("Failed 1:", JSON.stringify(res1.error.issues, null, 2));
else console.log("Success 1:", res1.data);

const res2 = TenantProfileUpdateSchema.safeParse(payload2);
if (!res2.success) console.error("Failed 2:", JSON.stringify(res2.error.issues, null, 2));
else console.log("Success 2:", res2.data);
