import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify admin access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non autorisé" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Accès refusé. Rôle administrateur requis." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tables } = await req.json();
    
    // Tables to export
    const tablesToExport = tables || ["profiles", "user_roles", "custom_roles", "role_permissions"];
    
    let sqlOutput = `-- Database Export\n-- Generated: ${new Date().toISOString()}\n-- Tables: ${tablesToExport.join(", ")}\n\n`;

    for (const tableName of tablesToExport) {
      sqlOutput += `-- =============================================\n`;
      sqlOutput += `-- Table: ${tableName}\n`;
      sqlOutput += `-- =============================================\n\n`;

      // Fetch all data from table
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select("*");

      if (error) {
        sqlOutput += `-- Error fetching ${tableName}: ${error.message}\n\n`;
        continue;
      }

      if (!data || data.length === 0) {
        sqlOutput += `-- No data in ${tableName}\n\n`;
        continue;
      }

      // Generate INSERT statements
      for (const row of data) {
        const columns = Object.keys(row);
        const values = columns.map((col) => {
          const val = row[col];
          if (val === null) return "NULL";
          if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
          if (typeof val === "number") return val.toString();
          if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return `'${String(val).replace(/'/g, "''")}'`;
        });

        sqlOutput += `INSERT INTO public.${tableName} (${columns.join(", ")}) VALUES (${values.join(", ")});\n`;
      }

      sqlOutput += `\n`;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sql: sqlOutput,
        exported_at: new Date().toISOString(),
        tables_count: tablesToExport.length,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erreur interne du serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
