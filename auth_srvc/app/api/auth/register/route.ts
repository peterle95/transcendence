export async function POST() {
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Not implemented - Architecture placeholder',
    }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}