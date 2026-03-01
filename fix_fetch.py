c=open('D:/git/rezervace-app/workers/admin-api/src/index.ts',encoding='utf-8').readlines()
c[36]='    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/system_settings?select=key,encrypted_value,iv`, {\n'
open('D:/git/rezervace-app/workers/admin-api/src/index.ts','w',encoding='utf-8',newline='\n').writelines(c)
print('OK:', repr(c[36][:60]))
