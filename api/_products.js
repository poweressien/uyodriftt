// Server copy of the price list (kobo = naira x 100). The server trusts THIS, never the browser.
export const PRODUCTS = {
  coins_s: 500, coins_m: 1500, coins_l: 4000, gas_full: 200, vip: 2000, style: 1000, car_sclass: 2500, car_escalade: 3500,
};
export const toKobo = n => n * 100;
