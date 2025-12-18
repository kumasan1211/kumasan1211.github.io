$(function () {
    $('#copy-url').click(function () {
        // data-urlの値を取得
        const url = $(this).data('url');

        // クリップボードにコピー
        navigator.clipboard.writeText(url);

        // フラッシュメッセージ表示
        $('.success-msg').fadeIn("slow", function () {
            $(this).delay(2000).fadeOut("slow");
        });
    });
});
