const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envVars = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      envVars[key] = val;
    }
  }
}

const token = envVars.WHATSAPP_ACCESS_TOKEN;
const phoneId = envVars.WHATSAPP_PHONE_NUMBER_ID || '1469947252866426';
const version = envVars.WHATSAPP_API_VERSION || 'v21.0';

const targetImage = process.argv[2] || 'el_establo_avatar_v3.jpg';
const imagePath = path.resolve(process.cwd(), 'public', 'brand', targetImage);

async function uploadAvatar() {
  console.log('=== SUBIENDO FOTO DE PERFIL A META WHATSAPP CLOUD API ===\n');
  
  if (!fs.existsSync(imagePath)) {
    throw new Error('No se encontró la imagen en: ' + imagePath);
  }

  const fileStats = fs.statSync(imagePath);
  const fileLength = fileStats.size;
  const fileBuffer = fs.readFileSync(imagePath);

  console.log(`Imagen lista: ${path.basename(imagePath)} (${fileLength} bytes)`);

  // Paso 1: Iniciar sesión de subida (Resumable Upload Session)
  console.log('1. Iniciando sesión de carga en Meta Graph API...');
  const initUrl = `https://graph.facebook.com/${version}/app/uploads?file_length=${fileLength}&file_type=image/jpeg&access_token=${token}`;
  
  const initRes = await fetch(initUrl, { method: 'POST' });
  const initData = await initRes.json();
  
  if (!initRes.ok || !initData.id) {
    console.error('Error al iniciar sesión de carga:', initData);
    process.exit(1);
  }

  const uploadSessionId = initData.id;
  console.log('   Sesión creada exitosamente:', uploadSessionId);

  // Paso 2: Subir los bytes binarios de la imagen
  console.log('2. Subiendo bytes de la imagen...');
  const uploadUrl = `https://graph.facebook.com/${version}/${uploadSessionId}`;
  
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${token}`,
      'file_offset': '0',
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || !uploadData.h) {
    console.error('Error al transferir imagen:', uploadData);
    process.exit(1);
  }

  const handle = uploadData.h;
  console.log('   Imagen cargada. Profile Picture Handle:', handle);

  // Paso 3: Asignar la foto de perfil en el perfil empresarial de WhatsApp
  console.log('3. Actualizando perfil empresarial de WhatsApp...');
  const profileUrl = `https://graph.facebook.com/${version}/${phoneId}/whatsapp_business_profile`;

  const profilePayload = {
    messaging_product: 'whatsapp',
    profile_picture_handle: handle,
    about: 'Parrilladas El Establo 🥩🔥 Los mejores cortes a la leña en Trujillo.',
    description: 'Restaurante especializado en carnes y parrilladas a la brasa.',
    vertical: 'RESTAURANT',
    address: 'Trujillo, Perú',
  };

  const profileRes = await fetch(profileUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profilePayload),
  });

  const profileData = await profileRes.json();
  if (!profileRes.ok || !profileData.success) {
    console.error('Error al actualizar perfil de WhatsApp:', profileData);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('✅ ¡FOTO DE PERFIL Y DATOS DE EMPRESA ACTUALIZADOS EXITOSAMENTE!');
  console.log('Resultado Meta:', profileData);
  console.log('================================================================');
}

uploadAvatar().catch(console.error);

