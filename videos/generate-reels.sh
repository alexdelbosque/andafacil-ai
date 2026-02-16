#!/bin/bash
# Generate Instagram/Facebook Reels from product images + ad copy
# Output: 1080x1920 (9:16) MP4, ~30 seconds each

ASSETS="/root/.openclaw/workspace/andafacil/videos/assets"
OUTPUT="/root/.openclaw/workspace/andafacil/videos"
FONT="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# Fix ImageMagick policy for text rendering
sed -i 's/rights="none" pattern="@\*"/rights="read|write" pattern="@*"/' /etc/ImageMagick-6/policy.xml 2>/dev/null
sed -i '/<policy domain="path"/d' /etc/ImageMagick-6/policy.xml 2>/dev/null

generate_frame() {
    local img="$1"
    local output="$2"
    local headline="$3"
    local subtext="$4"
    local price="$5"
    local badge="$6"
    local bg_color="${7:-#0B141A}"
    local accent="${8:-#00A884}"

    # Create 1080x1920 frame
    convert \
        -size 1080x1920 xc:"${bg_color}" \
        \( "$img" -resize 1080x1080^ -gravity center -extent 1080x1080 \) \
        -gravity north -geometry +0+200 -composite \
        \( -size 1000x1 xc:none \
           -font "$FONT" -pointsize 64 -fill white \
           -gravity center -annotate +0+0 "$headline" \
           -trim +repage -bordercolor none -border 20 \
           \( +clone -background black -shadow 80x4+0+0 \) +swap \
           -background none -layers merge +repage \) \
        -gravity south -geometry +0+350 -composite \
        \( -size 1000x1 xc:none \
           -font "$FONT_REG" -pointsize 40 -fill "rgba(255,255,255,0.85)" \
           -gravity center -annotate +0+0 "$subtext" \
           -trim +repage -bordercolor none -border 15 \) \
        -gravity south -geometry +0+250 -composite \
        \( -size 400x80 xc:"${accent}" \
           -font "$FONT" -pointsize 44 -fill white \
           -gravity center -annotate +0+0 "$price" \
           \( +clone -alpha extract -draw "roundrectangle 0,0 399,79 15,15" \
              -alpha off \) -compose CopyOpacity -composite \) \
        -gravity south -geometry +0+130 -composite \
        "$output"
}

generate_slide() {
    local output="$1"
    local text="$2"
    local bg_color="${3:-#0F2E25}"
    local text_color="${4:-white}"
    local size="${5:-56}"

    convert -size 1080x1920 xc:"${bg_color}" \
        -font "$FONT" -pointsize "$size" -fill "$text_color" \
        -gravity center -annotate +0+0 "$text" \
        "$output"
}

generate_branded_slide() {
    local output="$1"
    local main_text="$2"
    local sub_text="$3"
    local bg_color="${4:-#0B141A}"

    convert -size 1080x1920 xc:"${bg_color}" \
        -font "$FONT" -pointsize 72 -fill white \
        -gravity center -annotate +0-100 "$main_text" \
        -font "$FONT_REG" -pointsize 36 -fill "#00A884" \
        -gravity center -annotate +0+50 "$sub_text" \
        -font "$FONT" -pointsize 48 -fill "#00A884" \
        -gravity south -annotate +0+200 "andafacil.com" \
        "$output"
}

echo "🎬 Generating Reel 1: Andafacil Pro..."
mkdir -p "$OUTPUT/tmp1"

# Frame 1: Hook (0-3s) — emotional text on dark
generate_slide "$OUTPUT/tmp1/f01.png" \
    "Le devolvimos\nla libertad\na mi mama" "#0B141A" "white" 80

# Frame 2: Problem (3-10s) — emotional context
generate_slide "$OUTPUT/tmp1/f02.png" \
    "Cuando mi papa tuvo\nsu accidente,\npensamos que ya no\npodria salir de casa..." "#1a1a1a" "rgba(255,255,255,0.9)" 52

# Frame 3: Product reveal (10-20s) — product image with specs
generate_frame "$ASSETS/pro-silla.png" "$OUTPUT/tmp1/f03.png" \
    "Andafacil Pro" \
    "Electrica | Plegable | Todo Terreno" \
    '$18,999 MXN' \
    "" "#0B141A" "#00A884"

# Frame 4: Social proof (20-27s) — testimonial
generate_slide "$OUTPUT/tmp1/f04.png" \
    '"Le ayudo mucho a\nmi papa a desplazarse\nen lugares complicados\ny en pendientes,\nmuy buena calidad!"\n\n- Carlos R.' \
    "#0F2E25" "white" 48

# Frame 5: CTA (27-30s) — call to action
generate_branded_slide "$OUTPUT/tmp1/f05.png" \
    "Envio GRATIS\na todo Mexico" \
    "Garantia 1 ano | 30 dias de devolucion"

# Assemble video with ffmpeg
ffmpeg -y \
    -loop 1 -t 3 -i "$OUTPUT/tmp1/f01.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp1/f02.png" \
    -loop 1 -t 10 -i "$OUTPUT/tmp1/f03.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp1/f04.png" \
    -loop 1 -t 3 -i "$OUTPUT/tmp1/f05.png" \
    -filter_complex " \
        [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v0]; \
        [1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v1]; \
        [2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v2]; \
        [3:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v3]; \
        [4:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v4]; \
        [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[out]" \
    -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 30 \
    "$OUTPUT/reel-01-andafacil-pro.mp4" 2>&1 | tail -5

echo "✅ Reel 1 done: $(du -sh $OUTPUT/reel-01-andafacil-pro.mp4 | cut -f1)"


echo ""
echo "🎬 Generating Reel 2: EasyGo Portátil..."
mkdir -p "$OUTPUT/tmp2"

generate_slide "$OUTPUT/tmp2/f01.png" \
    "Mi mama no viajaba\nhace 3 anos...\n\nhasta ahora" "#0B141A" "white" 72

generate_slide "$OUTPUT/tmp2/f02.png" \
    "Pesaba tan solo 16kg\ny se pliega\nen segundos" "#1a1a1a" "rgba(255,255,255,0.9)" 56

generate_frame "$ASSETS/easygo.jpg" "$OUTPUT/tmp2/f03.png" \
    "Andafacil EasyGo" \
    "Portatil | 16kg | Plegable en segundos" \
    '$19,999 MXN' \
    "" "#0B141A" "#00A884"

generate_slide "$OUTPUT/tmp2/f04.png" \
    '"Es justo como lo\nnecesitabamos,\na mi mama le gusto\nmucho, buen material\ny flexible al andar"\n\n- Wen I.' \
    "#0F2E25" "white" 48

generate_branded_slide "$OUTPUT/tmp2/f05.png" \
    "Que vuelva a viajar" \
    "Cabe en la cajuela | Envio GRATIS"

ffmpeg -y \
    -loop 1 -t 3 -i "$OUTPUT/tmp2/f01.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp2/f02.png" \
    -loop 1 -t 10 -i "$OUTPUT/tmp2/f03.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp2/f04.png" \
    -loop 1 -t 3 -i "$OUTPUT/tmp2/f05.png" \
    -filter_complex " \
        [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v0]; \
        [1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v1]; \
        [2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v2]; \
        [3:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v3]; \
        [4:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v4]; \
        [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[out]" \
    -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 30 \
    "$OUTPUT/reel-02-easygo.mp4" 2>&1 | tail -5

echo "✅ Reel 2 done: $(du -sh $OUTPUT/reel-02-easygo.mp4 | cut -f1)"


echo ""
echo "🎬 Generating Reel 3: Andadera 2 en 1..."
mkdir -p "$OUTPUT/tmp3"

generate_slide "$OUTPUT/tmp3/f01.png" \
    "Caminar no deberia\ndar miedo" "#0B141A" "white" 80

generate_slide "$OUTPUT/tmp3/f02.png" \
    "1 de cada 3 adultos\nmayores sufre\nuna caida al ano\n\nEvitalo." "#1a1a1a" "rgba(255,255,255,0.9)" 52

generate_frame "$ASSETS/andadera-2en1.jpg" "$OUTPUT/tmp3/f03.png" \
    "Andadera 2 en 1" \
    "Con asiento | Plegable | Ligera" \
    '$6,499 MXN' \
    "" "#0B141A" "#00A884"

generate_slide "$OUTPUT/tmp3/f04.png" \
    '"Me ayuda bastante\nen mi dia a dia,\nno pesa, es facil\nde cerrar, el material\nes resistente"\n\n- Pam O.' \
    "#0F2E25" "white" 48

generate_branded_slide "$OUTPUT/tmp3/f05.png" \
    "Por menos de $6,500\nle cambias la vida" \
    "Envio GRATIS a todo Mexico"

ffmpeg -y \
    -loop 1 -t 3 -i "$OUTPUT/tmp3/f01.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp3/f02.png" \
    -loop 1 -t 10 -i "$OUTPUT/tmp3/f03.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp3/f04.png" \
    -loop 1 -t 3 -i "$OUTPUT/tmp3/f05.png" \
    -filter_complex " \
        [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v0]; \
        [1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v1]; \
        [2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v2]; \
        [3:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v3]; \
        [4:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v4]; \
        [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[out]" \
    -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 30 \
    "$OUTPUT/reel-03-andadera-2en1.mp4" 2>&1 | tail -5

echo "✅ Reel 3 done: $(du -sh $OUTPUT/reel-03-andadera-2en1.mp4 | cut -f1)"


echo ""
echo "🎬 Generating Reel 4: Silla 3 en 1..."
mkdir -p "$OUTPUT/tmp4"

generate_slide "$OUTPUT/tmp4/f01.png" \
    "Todo lo que necesita\nen UN solo producto" "#0B141A" "white" 72

generate_slide "$OUTPUT/tmp4/f02.png" \
    "Silla de ruedas\n+\nSilla reclinable\n+\nComodo integrado\n\n= 3 en 1" "#1a1a1a" "rgba(255,255,255,0.9)" 56

generate_frame "$ASSETS/silla-3en1.jpg" "$OUTPUT/tmp4/f03.png" \
    "Silla 3 en 1 Reclinable" \
    "Manual | Reclinable | Con comodo" \
    '$8,999 MXN' \
    "" "#0B141A" "#00A884"

generate_slide "$OUTPUT/tmp4/f04.png" \
    '"Excelente producto\ny servicio.\nApoyo total!"\n\n- Claudia E.' \
    "#0F2E25" "white" 52

generate_branded_slide "$OUTPUT/tmp4/f05.png" \
    "La solucion completa\npara tu familiar" \
    "Envio GRATIS | Garantia 1 ano"

ffmpeg -y \
    -loop 1 -t 3 -i "$OUTPUT/tmp4/f01.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp4/f02.png" \
    -loop 1 -t 10 -i "$OUTPUT/tmp4/f03.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp4/f04.png" \
    -loop 1 -t 3 -i "$OUTPUT/tmp4/f05.png" \
    -filter_complex " \
        [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v0]; \
        [1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v1]; \
        [2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v2]; \
        [3:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v3]; \
        [4:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v4]; \
        [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[out]" \
    -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 30 \
    "$OUTPUT/reel-04-silla-3en1.mp4" 2>&1 | tail -5

echo "✅ Reel 4 done: $(du -sh $OUTPUT/reel-04-silla-3en1.mp4 | cut -f1)"


echo ""
echo "🎬 Generating Reel 5: Pack 2x..."
mkdir -p "$OUTPUT/tmp5"

generate_slide "$OUTPUT/tmp5/f01.png" \
    "2 sillas electricas\npor el precio\nde 1" "#0B141A" "white" 80

generate_slide "$OUTPUT/tmp5/f02.png" \
    "Ahorra $25,000\nen el pack\nde 2 sillas\ntodo terreno" "#1a1a1a" "#00A884" 64

generate_frame "$ASSETS/pack-2x.jpg" "$OUTPUT/tmp5/f03.png" \
    "Pack 2x Todo Terreno" \
    "2 sillas | Portatiles | Todo terreno" \
    '$30,999 MXN' \
    "" "#0B141A" "#00A884"

generate_slide "$OUTPUT/tmp5/f04.png" \
    '"Es una compania\nmuy seria y cumple\ncon sus productos\nque son de buena\ncalidad"\n\n- Daniel P.' \
    "#0F2E25" "white" 48

generate_branded_slide "$OUTPUT/tmp5/f05.png" \
    "La oferta mas grande\nde Andafacil" \
    "45% de descuento | Envio GRATIS"

ffmpeg -y \
    -loop 1 -t 3 -i "$OUTPUT/tmp5/f01.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp5/f02.png" \
    -loop 1 -t 10 -i "$OUTPUT/tmp5/f03.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp5/f04.png" \
    -loop 1 -t 3 -i "$OUTPUT/tmp5/f05.png" \
    -filter_complex " \
        [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v0]; \
        [1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v1]; \
        [2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v2]; \
        [3:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v3]; \
        [4:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v4]; \
        [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[out]" \
    -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 30 \
    "$OUTPUT/reel-05-pack-2x.mp4" 2>&1 | tail -5

echo "✅ Reel 5 done: $(du -sh $OUTPUT/reel-05-pack-2x.mp4 | cut -f1)"

echo ""
echo "🎬 Generating Reel 6: Andadera Eléctrica..."
mkdir -p "$OUTPUT/tmp6"

generate_slide "$OUTPUT/tmp6/f01.png" \
    "Ya no tiene que\ndejar de caminar" "#0B141A" "white" 72

generate_slide "$OUTPUT/tmp6/f02.png" \
    "La primera andadera\nELECTRICA\nen Mexico\n\n5 productos en 1" "#1a1a1a" "rgba(255,255,255,0.9)" 56

generate_frame "$ASSETS/andadera-electrica.jpg" "$OUTPUT/tmp6/f03.png" \
    "Andadera Electrica Pro" \
    "5 en 1 | Electrica | Plegable" \
    '$11,999 MXN' \
    "" "#0B141A" "#00A884"

generate_slide "$OUTPUT/tmp6/f04.png" \
    '"Se ha vuelto\nel Andafacil en parte\nesencial de mi vida"\n\n- Ana O.' \
    "#0F2E25" "white" 52

generate_branded_slide "$OUTPUT/tmp6/f05.png" \
    "Devuelvele\nla confianza\nal caminar" \
    "Envio GRATIS | Garantia 1 ano"

ffmpeg -y \
    -loop 1 -t 3 -i "$OUTPUT/tmp6/f01.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp6/f02.png" \
    -loop 1 -t 10 -i "$OUTPUT/tmp6/f03.png" \
    -loop 1 -t 7 -i "$OUTPUT/tmp6/f04.png" \
    -loop 1 -t 3 -i "$OUTPUT/tmp6/f05.png" \
    -filter_complex " \
        [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v0]; \
        [1:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v1]; \
        [2:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=9.5:d=0.5[v2]; \
        [3:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=6.5:d=0.5[v3]; \
        [4:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fade=t=in:st=0:d=0.5,fade=t=out:st=2.5:d=0.5[v4]; \
        [v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[out]" \
    -map "[out]" -c:v libx264 -pix_fmt yuv420p -r 30 \
    "$OUTPUT/reel-06-andadera-electrica.mp4" 2>&1 | tail -5

echo "✅ Reel 6 done: $(du -sh $OUTPUT/reel-06-andadera-electrica.mp4 | cut -f1)"

# Cleanup temp files
rm -rf "$OUTPUT/tmp1" "$OUTPUT/tmp2" "$OUTPUT/tmp3" "$OUTPUT/tmp4" "$OUTPUT/tmp5" "$OUTPUT/tmp6"

echo ""
echo "🎉 All 6 reels generated!"
ls -lh "$OUTPUT"/reel-*.mp4
