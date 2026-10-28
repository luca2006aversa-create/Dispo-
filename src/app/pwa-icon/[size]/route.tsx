import { appIcon } from '@/lib/icon';

export function generateStaticParams() {
  return [{ size: '192' }, { size: '512' }];
}

export async function GET(_req: Request, ctx: RouteContext<'/pwa-icon/[size]'>) {
  const { size } = await ctx.params;
  return appIcon(size === '512' ? 512 : 192);
}
