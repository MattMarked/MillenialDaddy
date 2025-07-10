import { NextRequest, NextResponse } from 'next/server';
import { AdminRepository, DatabaseError } from '@/lib/database';
import { z } from 'zod';

const removeAdminSchema = z.object({
  id: z.string().uuid('Invalid admin ID format'),
});

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const { id } = removeAdminSchema.parse(body);
    
    // Check if admin exists
    const existingAdmin = await AdminRepository.findById(id);
    if (!existingAdmin) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Admin not found' 
        },
        { status: 404 }
      );
    }
    
    // Remove admin
    const deleted = await AdminRepository.delete(id);
    
    if (!deleted) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to remove admin' 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Admin removed successfully',
      removedAdmin: {
        id: existingAdmin.id,
        email: existingAdmin.email,
        name: existingAdmin.name,
      }
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Validation error',
          errors: error.errors 
        },
        { status: 400 }
      );
    }
    
    if (error instanceof DatabaseError) {
      console.error('Database error removing admin:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Database error occurred' 
        },
        { status: 500 }
      );
    }
    
    console.error('Unexpected error removing admin:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}