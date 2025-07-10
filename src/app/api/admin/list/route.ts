import { NextResponse } from 'next/server';
import { AdminRepository, DatabaseError } from '@/lib/database';

export async function GET() {
  try {
    // Get all admins
    const admins = await AdminRepository.list();
    
    // Transform to response format
    const adminList = admins.map(admin => ({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      isActive: admin.is_active,
      createdAt: admin.created_at,
      lastActive: admin.last_active,
    }));
    
    return NextResponse.json({
      success: true,
      admins: adminList,
      count: adminList.length,
    });
    
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error('Database error listing admins:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Database error occurred' 
        },
        { status: 500 }
      );
    }
    
    console.error('Unexpected error listing admins:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}