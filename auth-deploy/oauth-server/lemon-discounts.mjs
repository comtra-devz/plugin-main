/**
 * Lemon Squeezy API: create/delete discount for level-up codes (gamification).
 * Env: LEMON_SQUEEZY_API_KEY, LEMON_SQUEEZY_STORE_ID.
 * Variant 1y (Annual) from LEMON_VARIANT_1Y or default.
 */
import crypto from 'node:crypto';

const LEMON_API = 'https://api.lemonsqueezy.com/v1';
const LEVELS_WITH_DISCOUNT = [5, 10, 15, 20];

function getSecret() {
  return process.env.LEMON_LEVEL_DISCOUNT_SECRET || process.env.JWT_SECRET || 'comtra-level-discount';
}

/**
 * Generate unique code for user+level: COMTRA-L{level}-{hash}
 * Hash = first 8 chars of HMAC-SHA256(userId+level, secret), uppercase alphanumeric.
 */
export function generateLevelDiscountCode(userId, level) {
  const secret = getSecret();
  const hmac = crypto.createHmac('sha256', secret).update(`${userId}:${level}`).digest('hex');
  const alphanum = hmac.replace(/[^a-f0-9]/gi, '').toUpperCase().slice(0, 8);
  const suffix = alphanum.length >= 6 ? alphanum : (alphanum + 'X'.repeat(8)).slice(0, 8);
  return `COMTRA-L${level}-${suffix}`;
}

/**
 * Create a discount in Lemon Squeezy: single use, percent, limited to variant 1y.
 * @param {{ storeId: string, variantId1y: string, name: string, code: string, amountPercent: number }} opts
 * @returns {{ id: string, code: string } | null} discount id and code, or null on failure
 */
export async function createLevelDiscount(opts) {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  const storeId = opts.storeId || process.env.LEMON_SQUEEZY_STORE_ID;
  const variantId = opts.variantId1y || process.env.LEMON_VARIANT_1Y || '1345319';
  if (!apiKey || !storeId) {
    console.warn('lemon-discounts: LEMON_SQUEEZY_API_KEY or LEMON_SQUEEZY_STORE_ID missing');
    return null;
  }
  const body = {
    data: {
      type: 'discounts',
      attributes: {
        name: opts.name,
        code: opts.code,
        amount: opts.amountPercent,
        amount_type: 'percent',
        is_limited_to_products: true,
        is_limited_redemptions: true,
        max_redemptions: 1,
        duration: 'once',
      },
      relationships: {
        store: { data: { type: 'stores', id: String(storeId) } },
        variants: { data: [{ type: 'variants', id: String(variantId) }] },
      },
    },
  };
  try {
    const res = await fetch(`${LEMON_API}/discounts`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('lemon-discounts create', res.status, data);
      return null;
    }
    const id = data?.data?.id;
    const code = data?.data?.attributes?.code || opts.code;
    return id ? { id: String(id), code } : null;
  } catch (err) {
    console.error('lemon-discounts create', err);
    return null;
  }
}

/**
 * Delete a discount in Lemon Squeezy.
 * @param {string} discountId - Lemon Squeezy discount id
 * @returns {boolean} true if deleted or already gone
 */
export async function deleteLevelDiscount(discountId) {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY;
  if (!apiKey || !discountId) return true;
  try {
    const res = await fetch(`${LEMON_API}/discounts/${encodeURIComponent(discountId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 204 || res.status === 404) return true;
    const data = await res.json().catch(() => ({}));
    console.error('lemon-discounts delete', res.status, data);
    return false;
  } catch (err) {
    console.error('lemon-discounts delete', err);
    return false;
  }
}

export function isLevelWithDiscount(level) {
  return LEVELS_WITH_DISCOUNT.includes(Number(level));
}

export function discountPercentForLevel(level) {
  return Math.min(20, Math.floor(Number(level) / 5) * 5);
}
