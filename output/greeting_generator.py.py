class GreetingGenerator:
    def __init__(self, lang: str = 'en'):
        self.lang = lang
        self.greetings = {
            'en': 'hello world',
            'zh': '你好世界'
        }
    
    def display(self) -> None:
        """根据设置的语言输出问候语"""
        print(self.greetings.get(self.lang, 'hello world'))