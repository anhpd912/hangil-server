# Contact point + notification policy — tạo bằng UI, không provisioning

Hai file `.reference` ở đây **không được Grafana nạp**. Chúng là bản ghi lại cấu hình
mong muốn để dựng lại khi cần, chứ không phải config sống.

## Vì sao không để trong `provisioning/alerting/`

Grafana 11.4 nội suy `$TELEGRAM_CHAT_ID` thành số trước khi validate integration
Telegram, mà trường `chatid` bắt buộc là chuỗi — kể cả khi đã bọc ngoặc kép trong YAML.
Kết quả: Grafana thoát ngay lúc boot với

```
failed to unmarshal settings: json: cannot unmarshal number into Go struct field Config.chatid of type string
```

và crash-loop, kéo sập luôn phần dashboard. Đổi lại, chỉ contact point + notification
policy tạo bằng tay; `alert-rules.yml` vẫn nằm trong provisioning vì nó không tham
chiếu receiver và không chứa secret.

## Dựng lại bằng UI (~2 phút)

1. **Alerting → Contact points → Add contact point**
   - Name: `telegram`
   - Integration: Telegram
   - BOT API Token / Chat ID: lấy từ `/opt/monitoring/.env`
   - Parse mode: HTML, message: xem `contact-points.yml.reference`
   - Bấm **Test** — điện thoại phải nhận được tin
2. **Alerting → Notification policies → Default policy → Edit**
   - Contact point: `telegram`
   - Group by: `alertname`, group wait 30s, group interval 5m, repeat interval 4h
3. Thêm nested policy: matcher `severity = critical`, group wait 10s, repeat 1h

## Hệ quả

Contact point nằm trong SQLite của Grafana (volume `grafana_data`), không nằm trong git.
Mất volume = phải tạo lại tay theo các bước trên.
