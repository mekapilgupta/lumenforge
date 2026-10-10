import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
  const search = url.search ? url.search : '?color=beige';
  throw redirect(301, `/products/${params.slug}${search}`);
};
