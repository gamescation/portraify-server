import { NextResponse, type NextRequest } from 'next/server';
 

export const runtime = 'edge';
export const maxDuration = 10
 
export default function handler(request: NextRequest) {
//   const { searchParams } = new URL(request.url);
  const data = request.body;
  
  return NextResponse.json({ success: true });
}