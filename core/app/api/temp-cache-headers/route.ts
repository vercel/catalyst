import { credentialsFromFetch } from '~/lib/vdc/credentials-from-fetch';

export async function GET(request: Request) {
  const data = await credentialsFromFetch(request.headers);

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
