import { View, Text } from '@tarojs/components';
import './index.scss';

export default function UserAgreementPage() {

  return (
    <View className="agreement-page">
      <View className="agreement-content">
        <Text className="agreement-title">用户服务协议</Text>
        
        <Text className="agreement-update">更新日期：2026年6月1日</Text>
        <Text className="agreement-update">生效日期：2026年6月1日</Text>

        <Text className="section-title">一、总则</Text>
        <Text className="section-content">
          1.1 欢迎您使用"场景外语"小程序。为维护您的合法权益，请您在使用本服务前仔细阅读并充分理解本协议各条款内容，特别是免除或限制责任的相应条款。
        </Text>
        <Text className="section-content">
          1.2 您通过网络页面点击确认或以其他方式选择接受本协议，即表示您与本小程序运营方已达成协议并同意接受本协议的全部约定内容。
        </Text>

        <Text className="section-title">二、服务内容</Text>
        <Text className="section-content">
          2.1 本小程序为用户提供外语学习服务，包括但不限于：场景识别学习、单词记忆、复习提醒等功能。
        </Text>
        <Text className="section-content">
          2.2 用户注册登录后，可同步学习记录、收藏单词等数据至云端服务器。
        </Text>
        <Text className="section-content">
          2.3 我们保留随时变更、中断或终止部分或全部服务的权利。
        </Text>

        <Text className="section-title">三、用户账号</Text>
        <Text className="section-content">
          3.1 用户需通过邮箱验证码方式注册/登录本小程序。
        </Text>
        <Text className="section-content">
          3.2 用户应妥善保管账号信息，因账号保管不当造成的损失由用户自行承担。
        </Text>
        <Text className="section-content">
          3.3 用户不得将账号转让、出借给他人使用。
        </Text>

        <Text className="section-title">四、用户行为规范</Text>
        <Text className="section-content">
          4.1 用户不得利用本服务制作、复制、发布、传播含有下列内容的信息：
        </Text>
        <Text className="section-content">
          （1）反对宪法所确定的基本原则的；{'\n'}
          （2）危害国家安全，泄露国家秘密，颠覆国家政权，破坏国家统一的；{'\n'}
          （3）损害国家荣誉和利益的；{'\n'}
          （4）煽动民族仇恨、民族歧视，破坏民族团结的；{'\n'}
          （5）破坏国家宗教政策，宣扬邪教和封建迷信的；{'\n'}
          （6）散布谣言，扰乱社会秩序，破坏社会稳定的；{'\n'}
          （7）散布淫秽、色情、赌博、暴力、凶杀、恐怖或者教唆犯罪的；{'\n'}
          （8）侮辱或者诽谤他人，侵害他人合法权益的；{'\n'}
          （9）含有法律、行政法规禁止的其他内容的。
        </Text>

        <Text className="section-title">五、知识产权</Text>
        <Text className="section-content">
          5.1 本小程序的所有内容，包括但不限于文字、图片、音频、视频、软件、程序等，其知识产权归本小程序运营方所有。
        </Text>
        <Text className="section-content">
          5.2 未经授权，用户不得复制、修改、发布、出售上述内容。
        </Text>

        <Text className="section-title">六、免责声明</Text>
        <Text className="section-content">
          6.1 本小程序不对因网络状况、通讯线路等任何原因造成的服务中断或不能满足用户要求的情况承担责任。
        </Text>
        <Text className="section-content">
          6.2 用户使用本服务过程中产生的风险由用户自行承担。
        </Text>

        <Text className="section-title">七、协议修改</Text>
        <Text className="section-content">
          7.1 我们有权随时修改本协议，修改后的协议将在小程序内公布。您继续使用本服务即表示您接受修改后的协议。
        </Text>

        <Text className="section-title">八、联系我们</Text>
        <Text className="section-content">
          如您对本协议有任何疑问，可通过小程序内的反馈功能联系我们。
        </Text>
      </View>
    </View>
  );
}
