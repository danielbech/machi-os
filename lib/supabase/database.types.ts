export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          logo_url: string | null
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          logo_url?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          logo_url?: string | null
          color?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      areas: {
        Row: {
          id: string
          project_id: string
          name: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          sort_order?: number
          created_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          user_id: string
          name: string
          initials: string
          color: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          initials: string
          color?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          initials?: string
          color?: string | null
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          area_id: string
          title: string
          description: string | null
          day: string | null
          completed: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          area_id: string
          title: string
          description?: string | null
          day?: string | null
          completed?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          area_id?: string
          title?: string
          description?: string | null
          day?: string | null
          completed?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      task_assignees: {
        Row: {
          task_id: string
          team_member_id: string
        }
        Insert: {
          task_id: string
          team_member_id: string
        }
        Update: {
          task_id?: string
          team_member_id?: string
        }
      }
    }
  }
}
