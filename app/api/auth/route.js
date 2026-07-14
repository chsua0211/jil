// 정일님만 들어올 수 있게 하는 간단한 비밀번호 확인.
export async function POST(request) {
  const { password } = await request.json();
  const ok = password === process.env.ACCESS_PASSWORD;
  return Response.json({ ok });
}
