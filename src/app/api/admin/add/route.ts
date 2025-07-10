import { NextRequest, NextResponse } from 'next/server';
import { AdminRepository, DatabaseError } from '@/lib/database';
import { adminSchema } from '@/utils/validation';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = adminSchema.parse(body);
    
    // Check if admin already exists
    const existingAdmin = await AdminRepository.findByEmail(validatedData.email);
    if (existingAdmin) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Admin with this email already exists' 
        },
        { status: 409 }
      );
    }
    
    // Create new admin
    const newAdmin = await AdminRepository.create({
      email: validatedData.email,
      name: validatedData.name,
      is_active: validatedData.isActive,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Admin added successfully',
      admin: {
        id: newAdmin.id,
        email: newAdmin.email,
        name: newAdmin.name,
        isActive: newAdmin.is_active,
        createdAt: newAdmin.created_at,
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
      console.error('Database error adding admin:', error);
      return NextResponse.json(
        { 
          success: false, 
          message: 'Database error occurred' 
        },
        { status: 500 }
      );
    }
    
    console.error('Unexpected error adding admin:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}