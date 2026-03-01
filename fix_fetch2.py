c=open('D:/git/rezervace-app/workers/admin-api/src/index.ts',encoding='utf-8').readlines()
c[37]='      headers: { "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`, "apikey": env.SUPABASE_SERVICE_KEY },\n'
open('D:/git/rezervace-app/workers/admin-api/src/index.ts','w',encoding='utf-8',newline='\n').writelines(c)
print('OK:', repr(c[37][:70]))
