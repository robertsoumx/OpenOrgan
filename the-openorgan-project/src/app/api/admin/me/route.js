import { adminUidSet, apiError, requireServerUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const context = await requireServerUser(request);

    return Response.json(
      {
        uid: context.decoded.uid,
        isAdmin: adminUidSet().has(context.decoded.uid)
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    return apiError(error);
  }
}
