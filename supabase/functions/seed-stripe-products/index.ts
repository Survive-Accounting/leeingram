// Seed Stripe products, bundles, and coupons. One-time admin script.
// Protected by x-admin-key header matching ADMIN_SEED_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
};

type StripeMode = "test" | "live";

interface StripeContext {
  mode: StripeMode;
  key: string;
}

// ────────────────────────────────────────────────────────────
// Stripe REST helpers (no SDK; works in Deno)
// ────────────────────────────────────────────────────────────
async function stripeRequest(ctx: StripeContext, path: string, method: "GET" | "POST", body?: Record<string, string>) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${ctx.key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  // Idempotency: derive key from path+body so reruns don't dupe
  if (method === "POST" && body) {
    const idemSeed = path + ":" + JSON.stringify(body);
    headers["Idempotency-Key"] = await sha256(idemSeed);
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers,
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json);
    throw new Error(`Stripe ${method} ${path} [${res.status}]: ${msg}`);
  }
  return json;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function flattenMetadata(prefix: string, meta: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) {
    out[`${prefix}[${k}]`] = String(v);
  }
  return out;
}

// ────────────────────────────────────────────────────────────
// Search by metadata (idempotency check)
// ────────────────────────────────────────────────────────────
async function findProductByMetadata(ctx: StripeContext, key: string, value: string) {
  const q = encodeURIComponent(`metadata['${key}']:'${value}'`);
  const json = await stripeRequest(ctx, `/products/search?query=${q}&limit=1`, "GET");
  return json.data?.[0] ?? null;
}

async function findCoupon(ctx: StripeContext, id: string) {
  try {
    return await stripeRequest(ctx, `/coupons/${id}`, "GET");
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Build product/price for a course×semester
// ────────────────────────────────────────────────────────────
async function ensureCourseProductPrice(
  ctx: StripeContext,
  args: {
    course_id: string;
    semester_id: string;
    course_name: string;
    semester_name: string;
    year: number;
    end_date: string;
    amount_cents: number;
  }
) {
  const productKey = `course:${args.course_id}:${args.semester_id}`;
  let product = await findProductByMetadata(ctx, "lovable_seed_key", productKey);

  if (!product) {
    const meta = {
      lovable_seed_key: productKey,
      course_id: args.course_id,
      semester_id: args.semester_id,
      type: "semester_pass",
    };
    product = await stripeRequest(ctx, "/products", "POST", {
      name: `${args.course_name} — ${args.semester_name} ${args.year} Study Pass`,
      description: `Survive Accounting study pass. Access expires ${args.end_date}.`,
      ...flattenMetadata("metadata", meta),
    });
  }

  // Find existing active price for this product matching amount
  const prices = await stripeRequest(ctx, `/prices?product=${product.id}&active=true&limit=10`, "GET");
  let price = (prices.data ?? []).find((p: any) => p.unit_amount === args.amount_cents && p.currency === "usd");

  if (!price) {
    price = await stripeRequest(ctx, "/prices", "POST", {
      product: product.id,
      unit_amount: String(args.amount_cents),
      currency: "usd",
    });
  }

  return { product_id: product.id as string, price_id: price.id as string };
}

async function ensureBundleProductPrice(
  ctx: StripeContext,
  args: {
    bundle_key: string;
    name: string;
    description: string;
    course_ids: string[];
    semester_ids: string[];
    discount_percent: number;
    final_price_cents: number;
  }
) {
  let product = await findProductByMetadata(ctx, "lovable_seed_key", args.bundle_key);

  if (!product) {
    const meta = {
      lovable_seed_key: args.bundle_key,
      bundle: "true",
      course_ids: args.course_ids.join(","),
      semester_ids: args.semester_ids.join(","),
      discount_percent: args.discount_percent,
    };
    product = await stripeRequest(ctx, "/products", "POST", {
      name: args.name,
      description: args.description,
      ...flattenMetadata("metadata", meta),
    });
  }

  const prices = await stripeRequest(ctx, `/prices?product=${product.id}&active=true&limit=10`, "GET");
  let price = (prices.data ?? []).find((p: any) => p.unit_amount === args.final_price_cents && p.currency === "usd");

  if (!price) {
    price = await stripeRequest(ctx, "/prices", "POST", {
      product: product.id,
      unit_amount: String(args.final_price_cents),
      currency: "usd",
    });
  }

  return { product_id: product.id as string, price_id: price.id as string };
}

async function ensureCoupon(
  ctx: StripeContext,
  args: { id: string; percent_off: number; name: string; redeem_by?: number }
) {
  const existing = await findCoupon(ctx, args.id);
  if (existing) return existing;

  const body: Record<string, string> = {
    id: args.id,
    percent_off: String(args.percent_off),
    duration: "once",
    name: args.name,
  };
  if (args.redeem_by) body.redeem_by = String(args.redeem_by);
  return await stripeRequest(ctx, "/coupons", "POST", body);
}

// ────────────────────────────────────────────────────────────
// Bundle spec
// ────────────────────────────────────────────────────────────
const BUNDLE_SPECS = [
  { key: "intro_spring_summer_2026", name: "Intro 1 + Intro 2 — Spring→Summer 2026", course_codes: ["INTRO1", "INTRO2"], semesters: [{ name: "Spring", year: 2026 }, { name: "Summer", year: 2026 }], anchor: 50000, discount: 20, final: 40000 },
  { key: "intro_fall_winter_2026",   name: "Intro 1 + Intro 2 — Fall→Winter 2026",   course_codes: ["INTRO1", "INTRO2"], semesters: [{ name: "Fall",   year: 2026 }, { name: "Winter", year: 2026 }], anchor: 50000, discount: 20, final: 40000 },
  { key: "ia_spring_summer_2026",    name: "IA1 + IA2 — Spring→Summer 2026",         course_codes: ["IA1", "IA2"],       semesters: [{ name: "Spring", year: 2026 }, { name: "Summer", year: 2026 }], anchor: 50000, discount: 20, final: 40000 },
  { key: "ia_fall_winter_2026",      name: "IA1 + IA2 — Fall→Winter 2026",           course_codes: ["IA1", "IA2"],       semesters: [{ name: "Fall",   year: 2026 }, { name: "Winter", year: 2026 }], anchor: 50000, discount: 20, final: 40000 },
];

const COUPON_SPECS = [
  { id: "SPRING2026", name: "Spring 2026 Promo", percent_off: 20, redeem_by: Math.floor(new Date("2026-05-31T23:59:59Z").getTime() / 1000), type: "global_promo", priority: 0,  valid_from: "2026-01-01", valid_until: "2026-05-31" },
  { id: "SUMMER2026", name: "Summer 2026 Promo", percent_off: 30, redeem_by: Math.floor(new Date("2026-08-15T23:59:59Z").getTime() / 1000), type: "global_promo", priority: 0,  valid_from: "2026-05-15", valid_until: "2026-08-15" },
  { id: "FALL2026",   name: "Fall 2026 Promo",   percent_off: 20, redeem_by: Math.floor(new Date("2026-12-31T23:59:59Z").getTime() / 1000), type: "global_promo", priority: 0,  valid_from: "2026-08-01", valid_until: "2026-12-31" },
  { id: "WINTER2026", name: "Winter 2026 Promo", percent_off: 50, redeem_by: Math.floor(new Date("2026-01-31T23:59:59Z").getTime() / 1000), type: "global_promo", priority: 0,  valid_from: "2025-12-01", valid_until: "2026-01-31" },
  { id: "OLEMISS2026", name: "Ole Miss 2026",    percent_off: 20,                                                                        type: "campus",       priority: 40, valid_from: null,         valid_until: null },
];

// ────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth
  const adminKey = Deno.env.get("ADMIN_SEED_KEY");
  if (!adminKey) {
    return json({ error: "ADMIN_SEED_KEY not configured" }, 500);
  }
  if (req.headers.get("x-admin-key") !== adminKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const stripeTest = Deno.env.get("STRIPE_SECRET_KEY_TEST");
  const stripeLive = Deno.env.get("STRIPE_SECRET_KEY_LIVE");
  if (!stripeTest || !stripeLive) {
    return json({ error: "Stripe keys missing" }, 500);
  }

  const modes: StripeContext[] = [
    { mode: "test", key: stripeTest },
    { mode: "live", key: stripeLive },
  ];

  const errors: string[] = [];
  let products_created = 0;
  let bundles_created = 0;
  let coupons_created = 0;

  // Load courses + semesters
  const [{ data: courses, error: cErr }, { data: semesters, error: sErr }] = await Promise.all([
    supabase.from("courses").select("id, code, course_name"),
    supabase.from("semesters").select("id, name, year, end_date"),
  ]);
  if (cErr || sErr) return json({ error: cErr?.message || sErr?.message }, 500);

  const courseByCode: Record<string, any> = {};
  (courses ?? []).forEach((c) => { courseByCode[c.code] = c; });
  const semesterByKey: Record<string, any> = {};
  (semesters ?? []).forEach((s) => { semesterByKey[`${s.name}-${s.year}`] = s; });

  // ────────── STEP 1: Course × Semester products ──────────
  for (const course of courses ?? []) {
    for (const sem of semesters ?? []) {
      const updates: Record<string, string> = {};
      for (const ctx of modes) {
        try {
          const { product_id, price_id } = await ensureCourseProductPrice(ctx, {
            course_id: course.id,
            semester_id: sem.id,
            course_name: course.course_name,
            semester_name: sem.name,
            year: sem.year,
            end_date: sem.end_date,
            amount_cents: 25000,
          });
          updates[`stripe_product_id_${ctx.mode}`] = product_id;
          updates[`stripe_price_id_${ctx.mode}`] = price_id;
        } catch (e: any) {
          errors.push(`[${ctx.mode}] course ${course.code} × ${sem.name} ${sem.year}: ${(e as any).message}`);
        }
      }

      if (Object.keys(updates).length > 0) {
        // Upsert: check if row exists
        const { data: existing } = await supabase
          .from("course_products")
          .select("id")
          .eq("course_id", course.id)
          .eq("semester_id", sem.id)
          .maybeSingle();

        if (existing) {
          await supabase.from("course_products").update(updates).eq("id", existing.id);
        } else {
          await supabase.from("course_products").insert({
            course_id: course.id,
            semester_id: sem.id,
            product_type: "semester_pass",
            anchor_price_cents: 25000,
            price_cents: 25000,
            display_name: `${course.course_name} — ${sem.name} ${sem.year} Study Pass`,
            ...updates,
          });
        }
        products_created++;
      }
    }
  }

  // ────────── STEP 2: Bundle products ──────────
  for (const spec of BUNDLE_SPECS) {
    const courseObjs = spec.course_codes.map((c) => courseByCode[c]).filter(Boolean);
    const semObjs = spec.semesters.map((s) => semesterByKey[`${s.name}-${s.year}`]).filter(Boolean);
    if (courseObjs.length !== spec.course_codes.length || semObjs.length !== spec.semesters.length) {
      errors.push(`Bundle ${spec.key}: missing course or semester`);
      continue;
    }
    const course_ids = courseObjs.map((c: any) => c.id);
    const semester_ids = semObjs.map((s: any) => s.id);

    const updates: Record<string, string> = {};
    for (const ctx of modes) {
      try {
        const { product_id, price_id } = await ensureBundleProductPrice(ctx, {
          bundle_key: `bundle:${spec.key}`,
          name: spec.name,
          description: `Bundle: ${spec.discount}% off ${courseObjs.map((c: any) => c.course_name).join(" + ")}`,
          course_ids,
          semester_ids,
          discount_percent: spec.discount,
          final_price_cents: spec.final,
        });
        updates[`stripe_product_id_${ctx.mode}`] = product_id;
        updates[`stripe_price_id_${ctx.mode}`] = price_id;
      } catch (e: any) {
        errors.push(`[${ctx.mode}] bundle ${spec.key}: ${(e as any).message}`);
      }
    }

    if (Object.keys(updates).length > 0) {
      const { data: existing } = await supabase
        .from("bundle_products")
        .select("id")
        .eq("name", spec.name)
        .maybeSingle();

      const row = {
        name: spec.name,
        description: `Bundle: ${spec.discount}% off`,
        course_ids,
        semester_ids,
        is_preset: true,
        anchor_price_cents: spec.anchor,
        discount_percent: spec.discount,
        final_price_cents: spec.final,
        ...updates,
      };
      if (existing) {
        await supabase.from("bundle_products").update(updates).eq("id", existing.id);
      } else {
        await supabase.from("bundle_products").insert(row);
      }
      bundles_created++;
    }
  }

  // ────────── STEP 3: Coupons ──────────
  for (const spec of COUPON_SPECS) {
    const updates: Record<string, string> = {};
    for (const ctx of modes) {
      try {
        const c = await ensureCoupon(ctx, {
          id: spec.id,
          percent_off: spec.percent_off,
          name: spec.name,
          redeem_by: (spec as any).redeem_by,
        });
        updates[`stripe_coupon_id_${ctx.mode}`] = c.id;
      } catch (e: any) {
        errors.push(`[${ctx.mode}] coupon ${spec.id}: ${(e as any).message}`);
      }
    }

    if (Object.keys(updates).length > 0) {
      const { data: existing } = await supabase
        .from("coupons")
        .select("id")
        .eq("code", spec.id)
        .maybeSingle();

      const row: Record<string, unknown> = {
        code: spec.id,
        name: spec.name,
        type: spec.type,
        discount_percent: spec.percent_off,
        applicable_to: "all",
        priority: spec.priority,
        valid_from: spec.valid_from,
        valid_until: spec.valid_until,
        is_active: true,
        ...updates,
      };
      if (existing) {
        await supabase.from("coupons").update(updates).eq("id", existing.id);
      } else {
        await supabase.from("coupons").insert(row);
      }
      coupons_created++;
    }
  }

  return json({
    products_created,
    bundles_created,
    coupons_created,
    errors,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
