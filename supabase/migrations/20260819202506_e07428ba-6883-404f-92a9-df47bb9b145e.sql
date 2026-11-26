update public.notes
set content_html = regexp_replace(
      regexp_replace(content_html, '<table[\s\S]*?</table>', '', 'gi'),
      '<img[^>]*>', '', 'gi')
where id = 'c62c33f4-dd50-4b73-aefb-f8442de6c250';