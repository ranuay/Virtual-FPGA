library ieee;
use ieee.std_logic_1164.all;

-- Press btnC to count up and btnU to count down; the digit wraps 0..9.
-- The count is shown on digit 0; the other digits stay dark.
-- CLOCK_500Hz is provided by HDLBoard, not by the physical board: on hardware
-- this design needs a clock divider instead.
entity upDownCounter7Seg is
    port (
        CLOCK_500Hz : in  std_logic;
        btnC        : in  std_logic;
        btnU        : in  std_logic;
        seg         : out std_logic_vector(6 downto 0);
        dp          : out std_logic;
        an          : out std_logic_vector(3 downto 0)
    );
end entity;

architecture rtl of upDownCounter7Seg is

    -- Segment bits are gfedcba; a zero lights a segment.
    function to_segments(digit : integer range 0 to 9) return std_logic_vector is
    begin
        case digit is
            when 0 => return "1000000";
            when 1 => return "1111001";
            when 2 => return "0100100";
            when 3 => return "0110000";
            when 4 => return "0011001";
            when 5 => return "0010010";
            when 6 => return "0000010";
            when 7 => return "1111000";
            when 8 => return "0000000";
            when 9 => return "0010000";
        end case;
    end function;

    signal count    : integer range 0 to 9 := 0;
    -- The buttons as they were on the previous clock edge: a press is the
    -- edge where a button goes from released ('0') to pressed ('1').
    signal btn_prev : std_logic_vector(1 downto 0) := "00";

begin

    process (CLOCK_500Hz)
    begin
        if rising_edge(CLOCK_500Hz) then
            btn_prev <= btnC & btnU;

            if btn_prev(1) = '0' and btnC = '1' then      -- btnC: count up
                -- Tested before adding: 9 + 1 leaves the subtype's range.
                if count = 9 then
                    count <= 0;
                else
                    count <= count + 1;
                end if;
            elsif btn_prev(0) = '0' and btnU = '1' then   -- btnU: count down
                if count = 0 then
                    count <= 9;
                else
                    count <= count - 1;
                end if;
            end if;
        end if;
    end process;

    seg <= to_segments(count);
    dp <= '1';                       -- Decimal point off (active low).
    an <= "1110";                    -- Digit 0 only; the rest stay dark.
end architecture;
