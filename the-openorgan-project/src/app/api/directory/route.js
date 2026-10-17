import { getOrganDirectory, directoryMetadata } from "@/lib/directory-server";
export async function GET(){return Response.json({organs:await getOrganDirectory(),...directoryMetadata},{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300"}});}
